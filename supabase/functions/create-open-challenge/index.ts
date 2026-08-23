import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const allowedFields = new Set(["sport", "scheduledAt", "locationName", "challengeType", "stakeType", "stakeLabel", "stakeNote"]);
const allowedChallengeTypes = new Set(["casual", "practice", "ranked"]);
const allowedStakeTypes = new Set(["bragging_rights", "coffee", "drinks", "court_fee", "custom"]);

function jsonResponse(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function admin() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration"); return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    const authUserId = await getAuthenticatedUserId(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).some((key) => !allowedFields.has(key))) return jsonResponse(400, { error: "Unsupported open challenge fields" });
    const sport = typeof body.sport === "string" ? body.sport : "";
    const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
    const locationName = typeof body.locationName === "string" ? body.locationName.trim() : "";
    const challengeType = typeof body.challengeType === "string" ? body.challengeType : "";
    const stakeType = typeof body.stakeType === "string" && body.stakeType.trim() ? body.stakeType.trim() : "bragging_rights";
    const stakeLabel = typeof body.stakeLabel === "string" && body.stakeLabel.trim() ? body.stakeLabel.trim() : "Bragging Rights";
    const stakeNote = typeof body.stakeNote === "string" && body.stakeNote.trim() ? body.stakeNote.trim() : null;
    if (sport !== "pickleball" || !scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() || !locationName || locationName.length > 160 || !allowedChallengeTypes.has(challengeType) || !allowedStakeTypes.has(stakeType) || stakeLabel.length > 80 || (stakeNote?.length ?? 0) > 280 || (stakeType === "custom" && !stakeNote)) return jsonResponse(400, { error: "Invalid open challenge fields" });
    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin.from("profiles").select("id, username, display_name, vancouver_area, onboarding_completed").eq("auth_user_id", authUserId).maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for authenticated user" });
    if (!caller.onboarding_completed) return jsonResponse(422, { error: "Complete onboarding before posting an open challenge" });
    const { data: callerSport } = await supabaseAdmin.from("profile_sports").select("profile_id").eq("profile_id", caller.id).eq("sport_id", 3).eq("is_active", true).maybeSingle();
    if (!callerSport) return jsonResponse(422, { error: "Current profile is not ready for Pickleball challenges" });
    const { data: challenge, error: insertError } = await supabaseAdmin.from("challenges").insert({ sport_id: 3, challenger_profile_id: caller.id, opponent_profile_id: null, scheduled_at: scheduledAt.toISOString(), location_name: locationName, challenge_type: challengeType, stake_type: stakeType, stake_label: stakeLabel, stake_note: stakeNote, status: "pending", is_open: true }).select("id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, created_at").single();
    if (insertError || !challenge) return jsonResponse(500, { error: "Unable to post open challenge" });
    return jsonResponse(201, { challenge: { id: challenge.id, challengerProfileId: caller.id, challengerUsername: caller.username ?? caller.display_name, challengerDisplayName: caller.display_name, challengerArea: caller.vancouver_area, sportId: 3, sport: "pickleball", sportName: "Pickleball", scheduledAt: challenge.scheduled_at, locationName: challenge.location_name, challengeType: challenge.challenge_type, stakeType: challenge.stake_type, stakeLabel: challenge.stake_label, stakeNote: challenge.stake_note, createdAt: challenge.created_at } });
  } catch (error) { console.error("[create-open-challenge] unexpected failure", { error }); return jsonResponse(500, { error: "Unable to post open challenge" }); }
});
