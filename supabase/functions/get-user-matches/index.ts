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

type MatchRow = Record<string, unknown> & {
  id: string;
  challenge_id: string;
  challenger_profile_id: string;
  opponent_profile_id: string;
  location_name: string;
  played_at: string | null;
  result_status: "pending_submission" | "pending_confirmation";
  winner_profile_id: string | null;
  score_summary: string | null;
  submitted_at: string | null;
  submitted_by_profile_id: string | null;
  sports: { slug?: string } | Array<{ slug?: string }> | null;
  challenges: { status?: string; is_open?: boolean } | Array<{ status?: string; is_open?: boolean }> | null;
  challenger: { id?: string; display_name?: string } | Array<{ id?: string; display_name?: string }> | null;
  opponent: { id?: string; display_name?: string } | Array<{ id?: string; display_name?: string }> | null;
};

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

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function matchResponse(match: MatchRow, callerProfileId: string) {
  const challenger = one(match.challenger);
  const opponent = one(match.opponent);
  const sport = one(match.sports);
  const callerIsChallenger = match.challenger_profile_id === callerProfileId;
  const counterpart = callerIsChallenger ? opponent : challenger;
  const isPendingConfirmation = match.result_status === "pending_confirmation";

  return {
    id: match.id,
    challengeId: match.challenge_id,
    sport: sport?.slug ?? "pickleball",
    scheduledAt: match.played_at,
    locationName: match.location_name,
    challenger: {
      profileId: match.challenger_profile_id,
      displayName: challenger?.display_name ?? "Player"
    },
    opponent: {
      profileId: match.opponent_profile_id,
      displayName: opponent?.display_name ?? "Player"
    },
    counterpart: {
      profileId: counterpart?.id ?? (callerIsChallenger ? match.opponent_profile_id : match.challenger_profile_id),
      displayName: counterpart?.display_name ?? "Player"
    },
    callerIsChallenger,
    resultStatus: match.result_status,
    winnerProfileId: match.winner_profile_id,
    scoreSummary: match.score_summary,
    submittedAt: match.submitted_at,
    waitingForOpponent: isPendingConfirmation && match.submitted_by_profile_id === callerProfileId,
    waitingForCurrentUser: isPendingConfirmation && match.submitted_by_profile_id !== callerProfileId
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const claims = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = claims ? getFirebaseUid(claims) : null;
    if (!firebaseUid) return jsonResponse(401, { error: "Unauthorized" });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return jsonResponse(400, { error: "Invalid request body" });

    const keys = Object.keys(body);
    const isListRequest = keys.length === 0;
    const isDetailRequest = keys.length === 1 && keys[0] === "matchId" && typeof body.matchId === "string";
    if (!isListRequest && !isDetailRequest) return jsonResponse(400, { error: "Unsupported match request fields" });

    const matchId = isDetailRequest ? body.matchId.trim() : null;
    if (matchId && !uuidPattern.test(matchId)) return jsonResponse(400, { error: "Invalid match id" });

    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for Firebase user" });

    let query = supabaseAdmin
      .from("matches")
      .select("id, challenge_id, challenger_profile_id, opponent_profile_id, location_name, played_at, result_status, winner_profile_id, score_summary, submitted_at, submitted_by_profile_id, sports!inner(slug), challenges!inner(status, is_open), challenger:profiles!matches_challenger_profile_id_fkey(id, display_name), opponent:profiles!matches_opponent_profile_id_fkey(id, display_name)")
      .or(`challenger_profile_id.eq.${caller.id},opponent_profile_id.eq.${caller.id}`)
      .eq("challenges.status", "accepted")
      .eq("challenges.is_open", false)
      .in("result_status", ["pending_submission", "pending_confirmation"]);

    if (matchId) query = query.eq("id", matchId);
    const { data, error } = await query.order("played_at", { ascending: true });
    if (error) return jsonResponse(500, { error: "Unable to load matches" });

    const matches = ((data ?? []) as MatchRow[]).map((match) => matchResponse(match, caller.id));
    if (matchId && matches.length === 0) return jsonResponse(404, { error: "Match not found" });

    return jsonResponse(200, matchId ? { match: matches[0] } : { matches });
  } catch (error) {
    console.error("[get-user-matches] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to load matches" });
  }
});
