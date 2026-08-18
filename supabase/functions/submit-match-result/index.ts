import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxScoreSummaryLength = 120;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function verifyFirebaseToken(header: string | null) {
  if (!firebaseProjectId || !header?.startsWith("Bearer ")) return null;
  try {
    return (await jwtVerify(header.slice(7).trim(), firebaseJwks, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId
    })).payload;
  } catch {
    return null;
  }
}

function getFirebaseUid(payload: JWTPayload) {
  return typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : null;
}

function admin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase function configuration");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const claims = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = claims ? getFirebaseUid(claims) : null;
    if (!firebaseUid) return jsonResponse(401, { error: "Unauthorized" });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).some((key) => !["matchId", "winnerProfileId", "scoreSummary"].includes(key))) {
      return jsonResponse(400, { error: "Unsupported result submission fields" });
    }

    const matchId = typeof body.matchId === "string" ? body.matchId.trim() : "";
    const winnerProfileId = typeof body.winnerProfileId === "string" ? body.winnerProfileId.trim() : "";
    if (!uuidPattern.test(matchId) || !uuidPattern.test(winnerProfileId)) {
      return jsonResponse(400, { error: "Invalid match result identifiers" });
    }
    if (body.scoreSummary !== undefined && typeof body.scoreSummary !== "string") {
      return jsonResponse(400, { error: "Invalid score summary" });
    }
    const scoreSummary = typeof body.scoreSummary === "string" ? body.scoreSummary.trim() : "";
    if (scoreSummary.length > maxScoreSummaryLength) {
      return jsonResponse(400, { error: "Score summary is too long" });
    }

    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for Firebase user" });

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id, challenge_id, challenger_profile_id, opponent_profile_id, result_status, challenges!inner(status, is_open)")
      .eq("id", matchId)
      .or(`challenger_profile_id.eq.${caller.id},opponent_profile_id.eq.${caller.id}`)
      .maybeSingle();
    if (matchError) return jsonResponse(500, { error: "Unable to load match" });
    if (!match) return jsonResponse(404, { error: "Match not found" });

    const challenge = Array.isArray(match.challenges) ? match.challenges[0] : match.challenges;
    if (!challenge || challenge.is_open || challenge.status !== "accepted") {
      return jsonResponse(409, { error: "Match is not ready for result submission" });
    }
    if (match.result_status !== "pending_submission") {
      return jsonResponse(409, { error: "Match result is no longer pending" });
    }
    if (![match.challenger_profile_id, match.opponent_profile_id].includes(winnerProfileId)) {
      return jsonResponse(400, { error: "Winner must be a match participant" });
    }

    const loserProfileId = winnerProfileId === match.challenger_profile_id
      ? match.opponent_profile_id
      : match.challenger_profile_id;
    const { data: submittedMatch, error: rpcError } = await supabaseAdmin.rpc("submit_match_result", {
      target_match_id: match.id,
      submitter_profile_id_param: caller.id,
      winner_profile_id_param: winnerProfileId,
      loser_profile_id_param: loserProfileId,
      score_summary_param: scoreSummary || null,
      result_notes_param: null
    });

    if (rpcError) {
      if (rpcError.code === "P0001") {
        return jsonResponse(409, { error: "Match result is no longer pending" });
      }
      return jsonResponse(500, { error: "Unable to submit match result" });
    }
    if (!submittedMatch) return jsonResponse(500, { error: "Unable to submit match result" });

    const result = submittedMatch as { id: string; result_status: string; submitted_at: string | null };
    return jsonResponse(200, {
      match: {
        id: result.id,
        resultStatus: result.result_status,
        submittedAt: result.submitted_at,
        waitingForOpponent: true
      }
    });
  } catch (error) {
    console.error("[submit-match-result] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to submit match result" });
  }
});
