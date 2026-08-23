import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const allowedActions = new Set(["accept", "decline", "cancel"]);

type Action = "accept" | "decline" | "cancel";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}



function admin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration");
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function challengeResponse(challenge: Record<string, unknown>, callerId: string) {
  const outgoing = challenge.challenger_profile_id === callerId;
  const counterpart = (outgoing ? challenge.opponent : challenge.challenger) as { username: string | null; display_name: string } | null;
  const sport = Array.isArray(challenge.sports) ? challenge.sports[0] : challenge.sports as { slug?: string } | null;
  return {
    id: challenge.id,
    direction: outgoing ? "outgoing" : "incoming",
    opponent: {
      username: counterpart?.username ?? counterpart?.display_name ?? "Player",
      displayName: counterpart?.display_name ?? "Player"
    },
    sport: sport?.slug ?? "pickleball",
    challengeType: challenge.challenge_type,
    status: challenge.status,
    createdAt: challenge.created_at,
    scheduledAt: challenge.scheduled_at,
    locationName: challenge.location_name,
    stakeType: challenge.stake_type,
    stakeLabel: challenge.stake_label,
    stakeNote: challenge.stake_note
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const authUserId = await getAuthenticatedUserId(request);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).length !== 2 || !("challengeId" in body) || !("action" in body)) {
      return jsonResponse(400, { error: "Unsupported challenge response fields" });
    }

    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const action = typeof body.action === "string" ? body.action as Action : "";
    if (!challengeId || !allowedActions.has(action)) return jsonResponse(400, { error: "Invalid challenge response" });

    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for authenticated user" });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("challenges")
      .select("id, challenger_profile_id, opponent_profile_id, status, is_open")
      .eq("id", challengeId)
      .maybeSingle();
    if (existingError) return jsonResponse(500, { error: "Unable to load challenge" });
    if (!existing) return jsonResponse(404, { error: "Challenge not found" });
    if (existing.is_open) return jsonResponse(400, { error: "Open challenges are not supported by this action" });

    const requiredProfileId = action === "cancel" ? existing.challenger_profile_id : existing.opponent_profile_id;
    if (requiredProfileId !== caller.id) return jsonResponse(403, { error: "You are not allowed to perform this challenge action" });
    if (existing.status !== "pending") return jsonResponse(409, { error: "This challenge is no longer pending" });

    const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : "canceled";
    const timestampColumn = action === "accept" ? "accepted_at" : action === "decline" ? "declined_at" : "canceled_at";
    const roleColumn = action === "cancel" ? "challenger_profile_id" : "opponent_profile_id";
    const update = { status, [timestampColumn]: new Date().toISOString() };
    const { data: rows, error: updateError } = await supabaseAdmin
      .from("challenges")
      .update(update)
      .eq("id", challengeId)
      .eq(roleColumn, caller.id)
      .eq("status", "pending")
      .select("id, challenger_profile_id, opponent_profile_id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, status, created_at, sports!inner(slug), challenger:profiles!challenges_challenger_profile_id_fkey(username, display_name), opponent:profiles!challenges_opponent_profile_id_fkey(username, display_name)");
    if (updateError) return jsonResponse(500, { error: "Unable to update challenge" });
    if (!rows?.length) return jsonResponse(409, { error: "This challenge was updated by another action" });

    const challenge = challengeResponse(rows[0] as Record<string, unknown>, caller.id);
    if (action !== "accept") return jsonResponse(200, { challenge });

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id, result_status")
      .eq("challenge_id", challengeId)
      .maybeSingle();
    if (matchError || !match) return jsonResponse(500, { error: "Accepted challenge did not create a match" });

    return jsonResponse(200, {
      challenge,
      match: { id: match.id, resultStatus: match.result_status }
    });
  } catch (error) {
    console.error("[respond-to-challenge] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to update challenge" });
  }
});
