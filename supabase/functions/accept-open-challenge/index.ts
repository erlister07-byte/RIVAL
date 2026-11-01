import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { isPairBlocked } from "../_shared/block.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
function jsonResponse(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function admin() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration"); return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    const authUserId = await getAuthenticatedUserId(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).length !== 1 || typeof body.challengeId !== "string" || !body.challengeId) return jsonResponse(400, { error: "Invalid open challenge request" });
    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin.from("profiles").select("id, onboarding_completed").eq("auth_user_id", authUserId).maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for authenticated user" });
    if (!caller.onboarding_completed) return jsonResponse(422, { error: "Complete onboarding before joining an open challenge" });
    const { data: target, error: targetError } = await supabaseAdmin.from("challenges").select("challenger_profile_id").eq("id", body.challengeId).eq("is_open", true).eq("status", "pending").maybeSingle();
    if (targetError) return jsonResponse(500, { error: "Unable to accept open challenge" });
    if (!target || await isPairBlocked(supabaseAdmin, caller.id, target.challenger_profile_id)) return jsonResponse(409, { error: "This open challenge is no longer available" });
    const { data: rows, error: updateError } = await supabaseAdmin.rpc("social_accept_challenge", {
      trusted_actor_auth_user_id: authUserId,
      target_challenge_id: body.challengeId,
      join_open: true
    }).select("id");
    if (updateError?.code === "P0001") return jsonResponse(409, { error: "This open challenge is no longer available" });
    if (updateError) return jsonResponse(500, { error: "Unable to accept open challenge" });
    if (!rows?.length) return jsonResponse(409, { error: "This open challenge is no longer available" });
    const { data: match, error: matchError } = await supabaseAdmin.from("matches").select("id, result_status").eq("challenge_id", body.challengeId).maybeSingle();
    if (matchError || !match) return jsonResponse(500, { error: "Accepted challenge did not create a match" });
    return jsonResponse(200, { matchId: match.id, resultStatus: match.result_status });
  } catch (error) { console.error("[accept-open-challenge] unexpected failure", { error }); return jsonResponse(500, { error: "Unable to accept open challenge" }); }
});
