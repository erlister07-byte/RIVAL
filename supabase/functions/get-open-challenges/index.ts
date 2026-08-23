import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function admin() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration"); return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }

function mapOpenChallenge(challenge: Record<string, unknown>) {
  const challenger = challenge.challenger as { id: string; username: string | null; display_name: string; vancouver_area: string } | null;
  const sport = Array.isArray(challenge.sports) ? challenge.sports[0] : challenge.sports as { id: number; slug: string; name: string } | null;
  return { id: challenge.id, challengerProfileId: challenge.challenger_profile_id, challengerUsername: challenger?.username ?? challenger?.display_name ?? "Player", challengerDisplayName: challenger?.display_name ?? "Player", challengerArea: challenger?.vancouver_area ?? "Vancouver", sportId: sport?.id ?? 3, sport: sport?.slug ?? "pickleball", sportName: sport?.name ?? "Pickleball", scheduledAt: challenge.scheduled_at, locationName: challenge.location_name, challengeType: challenge.challenge_type, stakeType: challenge.stake_type, stakeLabel: challenge.stake_label, stakeNote: challenge.stake_note, createdAt: challenge.created_at };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    const authUserId = await getAuthenticatedUserId(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).length !== 1 || body.sport !== "pickleball") return jsonResponse(400, { error: "Unsupported open challenge filters" });
    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin.from("profiles").select("id, onboarding_completed").eq("auth_user_id", authUserId).maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for authenticated user" });
    if (!caller.onboarding_completed) return jsonResponse(422, { error: "Complete onboarding before viewing open challenges" });
    const selection = "id, challenger_profile_id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, created_at, sports!inner(id, slug, name), challenger:profiles!challenges_challenger_profile_id_fkey(id, username, display_name, vancouver_area)";
    const base = () => supabaseAdmin.from("challenges").select(selection).eq("sport_id", 3).eq("is_open", true).eq("status", "pending").is("opponent_profile_id", null).gt("scheduled_at", new Date().toISOString()).order("created_at", { ascending: false });
    const [{ data: challenges, error: challengesError }, { data: ownChallenges, error: ownChallengesError }] = await Promise.all([base().neq("challenger_profile_id", caller.id), base().eq("challenger_profile_id", caller.id)]);
    if (challengesError || ownChallengesError) return jsonResponse(500, { error: "Unable to load open challenges" });
    return jsonResponse(200, { challenges: (challenges ?? []).map((challenge) => mapOpenChallenge(challenge as Record<string, unknown>)), ownChallenges: (ownChallenges ?? []).map((challenge) => mapOpenChallenge(challenge as Record<string, unknown>)) });
  } catch (error) { console.error("[get-open-challenges] unexpected failure", { error }); return jsonResponse(500, { error: "Unable to load open challenges" }); }
});
