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
const firebaseJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const allowedFields = new Set(["opponentProfileId", "sport", "scheduledAt", "locationName", "challengeType", "stakeType", "stakeLabel", "stakeNote"]);
const allowedChallengeTypes = new Set(["casual", "practice", "ranked"]);
const allowedStakeTypes = new Set(["bragging_rights", "coffee", "drinks", "court_fee", "custom"]);

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifyFirebaseToken(header: string | null) {
  if (!firebaseProjectId || !header?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), firebaseJwks, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId
    });
    return payload;
  } catch {
    return null;
  }
}

function getFirebaseUid(payload: JWTPayload) {
  return typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : null;
}

function admin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration");
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const claims = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = claims ? getFirebaseUid(claims) : null;
    if (!firebaseUid) return jsonResponse(401, { error: "Unauthorized" });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).some((key) => !allowedFields.has(key))) return jsonResponse(400, { error: "Unsupported challenge fields" });
    const opponentProfileId = typeof body.opponentProfileId === "string" ? body.opponentProfileId : "";
    const sport = typeof body.sport === "string" ? body.sport : "";
    const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
    const locationName = typeof body.locationName === "string" ? body.locationName.trim() : "";
    const challengeType = typeof body.challengeType === "string" ? body.challengeType : "";
    const stakeType = typeof body.stakeType === "string" && body.stakeType.trim() ? body.stakeType.trim() : "bragging_rights";
    const stakeLabel = typeof body.stakeLabel === "string" && body.stakeLabel.trim() ? body.stakeLabel.trim() : "Bragging Rights";
    const stakeNote = typeof body.stakeNote === "string" && body.stakeNote.trim() ? body.stakeNote.trim() : null;

    if (!opponentProfileId || sport !== "pickleball" || !scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() || !locationName || locationName.length > 160 || !allowedChallengeTypes.has(challengeType) || !allowedStakeTypes.has(stakeType) || stakeLabel.length > 80 || (stakeNote?.length ?? 0) > 280 || (stakeType === "custom" && !stakeNote)) {
      return jsonResponse(400, { error: "Invalid direct challenge fields" });
    }

    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id, onboarding_completed")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for Firebase user" });
    if (!caller.onboarding_completed) return jsonResponse(422, { error: "Complete onboarding before creating a challenge" });
    if (caller.id === opponentProfileId) return jsonResponse(400, { error: "You cannot challenge yourself" });

    const [{ data: callerSport }, { data: opponent, error: opponentError }] = await Promise.all([
      supabaseAdmin.from("profile_sports").select("profile_id").eq("profile_id", caller.id).eq("sport_id", 3).eq("is_active", true).maybeSingle(),
      supabaseAdmin.from("profiles").select("id, username, display_name, onboarding_completed").eq("id", opponentProfileId).maybeSingle()
    ]);
    if (!callerSport) return jsonResponse(422, { error: "Current profile is not ready for Pickleball challenges" });
    if (opponentError) return jsonResponse(500, { error: "Unable to validate opponent" });
    if (!opponent || !opponent.onboarding_completed) return jsonResponse(404, { error: "Opponent is not available" });
    const { data: opponentSport } = await supabaseAdmin.from("profile_sports").select("profile_id").eq("profile_id", opponent.id).eq("sport_id", 3).eq("is_active", true).maybeSingle();
    if (!opponentSport) return jsonResponse(422, { error: "Opponent is not available for Pickleball challenges" });

    const { data: challenge, error: insertError } = await supabaseAdmin
      .from("challenges")
      .insert({ sport_id: 3, challenger_profile_id: caller.id, opponent_profile_id: opponent.id, scheduled_at: scheduledAt.toISOString(), location_name: locationName, challenge_type: challengeType, stake_type: stakeType, stake_label: stakeLabel, stake_note: stakeNote, is_open: false, status: "pending" })
      .select("id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, status, created_at")
      .single();
    if (insertError || !challenge) return jsonResponse(500, { error: "Unable to create challenge" });

    return jsonResponse(201, { challenge: { id: challenge.id, direction: "outgoing", opponent: { username: opponent.username ?? opponent.display_name, displayName: opponent.display_name }, sport: "pickleball", challengeType: challenge.challenge_type, status: challenge.status, createdAt: challenge.created_at, scheduledAt: challenge.scheduled_at, locationName: challenge.location_name, stakeType: challenge.stake_type, stakeLabel: challenge.stake_label, stakeNote: challenge.stake_note } });
  } catch (error) {
    console.error("[create-direct-challenge] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to create challenge" });
  }
});
