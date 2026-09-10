import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
function jsonResponse(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

type ProfileIdentityRow = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
};

type ChallengeRow = Record<string, unknown> & {
  id: string;
  challenger_profile_id: string;
  opponent_profile_id: string | null;
  scheduled_at: string;
  location_name: string;
  challenge_type: string;
  stake_type: string | null;
  stake_label: string | null;
  stake_note: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  canceled_at: string | null;
  completed_at: string | null;
  is_open: boolean;
  sports: { slug?: string } | Array<{ slug?: string }> | null;
  challenger: ProfileIdentityRow | ProfileIdentityRow[] | null;
  opponent: ProfileIdentityRow | ProfileIdentityRow[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function profileIdentity(profile: ProfileIdentityRow | null, profileId: string) {
  const displayName = profile?.display_name?.trim() || profile?.username?.trim() || "Opponent";
  const username = profile?.username?.trim() || displayName;

  return { profileId, displayName, username };
}

function challengeResponse(row: ChallengeRow, callerProfileId: string) {
  const outgoing = row.challenger_profile_id === callerProfileId;
  const challenger = profileIdentity(one(row.challenger), row.challenger_profile_id);
  const opponent = row.opponent_profile_id
    ? profileIdentity(one(row.opponent), row.opponent_profile_id)
    : null;
  const counterpart = outgoing ? opponent : challenger;
  const legacyCounterpart = counterpart ?? {
    profileId: row.id,
    displayName: "Opponent",
    username: "Opponent"
  };
  const sport = one(row.sports);

  return {
    id: row.id,
    direction: outgoing ? "outgoing" : "incoming",
    // Preserve the original Loop 02 counterpart alias for backward compatibility.
    opponent: {
      username: legacyCounterpart.username,
      displayName: legacyCounterpart.displayName
    },
    participants: { challenger, opponent },
    counterpart,
    challengerProfileId: row.challenger_profile_id,
    opponentProfileId: row.opponent_profile_id,
    sport: sport?.slug ?? "pickleball",
    challengeType: row.challenge_type,
    status: row.status,
    createdAt: row.created_at,
    scheduledAt: row.scheduled_at,
    locationName: row.location_name,
    stakeType: row.stake_type,
    stakeLabel: row.stake_label,
    stakeNote: row.stake_note,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    canceledAt: row.canceled_at,
    completedAt: row.completed_at,
    isOpen: row.is_open
  };
}


function admin() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration"); return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    const authUserId = await getAuthenticatedUserId(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (Object.keys(body).length > 0) return jsonResponse(400, { error: "This request does not accept filters" });
    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin.from("profiles").select("id").eq("auth_user_id", authUserId).maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for authenticated user" });
    const { data: rows, error } = await supabaseAdmin.from("challenges").select("id, challenger_profile_id, opponent_profile_id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, status, created_at, accepted_at, declined_at, canceled_at, completed_at, is_open, sports!inner(slug), challenger:profiles!challenges_challenger_profile_id_fkey(id, username, display_name), opponent:profiles!challenges_opponent_profile_id_fkey(id, username, display_name)").or(`challenger_profile_id.eq.${caller.id},opponent_profile_id.eq.${caller.id}`).order("created_at", { ascending: false });
    if (error) return jsonResponse(500, { error: "Unable to load challenges" });
    const callerChallenges = (rows ?? []) as ChallengeRow[];
    const challenges = callerChallenges
      .filter((row) => !row.is_open)
      .map((row) => challengeResponse(row, caller.id));
    const openChallenges = callerChallenges
      .filter((row) => row.is_open)
      .map((row) => challengeResponse(row, caller.id));

    return jsonResponse(200, { challenges, openChallenges });
  } catch (error) { console.error("[get-user-challenges] unexpected failure", { error }); return jsonResponse(500, { error: "Unable to load challenges" }); }
});
