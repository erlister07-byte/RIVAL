import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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
    const authUserId = await getAuthenticatedUserId(request);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).length !== 1 || typeof body.matchId !== "string") {
      return jsonResponse(400, { error: "Unsupported dispute fields" });
    }

    const matchId = body.matchId.trim();
    if (!uuidPattern.test(matchId)) return jsonResponse(400, { error: "Invalid match id" });

    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for authenticated user" });

    const { data: disputedMatch, error: rpcError } = await supabaseAdmin.rpc("reject_match_result", {
      target_match_id: matchId,
      rejecting_profile_id: caller.id
    });
    if (rpcError) {
      if (rpcError.code === "P0001") {
        return jsonResponse(409, { error: "Match result can no longer be disputed" });
      }
      return jsonResponse(500, { error: "Unable to dispute match result" });
    }
    if (!disputedMatch) return jsonResponse(500, { error: "Unable to dispute match result" });

    const result = disputedMatch as { id: string; result_status: string };
    return jsonResponse(200, {
      match: {
        id: result.id,
        resultStatus: result.result_status
      }
    });
  } catch (error) {
    console.error("[reject-match-result] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to dispute match result" });
  }
});
