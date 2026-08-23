import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");


function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}



function createSupabaseAdmin() {
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getProfileSelect() {
  return `
    id,
    auth_user_id,
    email,
    username,
    display_name,
    vancouver_area,
    challenge_radius_km,
    availability_status,
    onboarding_completed,
    profile_sports (
      profile_id,
      sport_id,
      skill_level,
      is_active,
      sports (id, slug, name)
    ),
    profile_stats (profile_id, wins, losses, matches_played)
  `;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authUserId = await getAuthenticatedUserId(request);

    const supabaseAdmin = createSupabaseAdmin();
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(getProfileSelect())
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      console.error("[get-current-profile] profile lookup failed", { error });
      return jsonResponse(500, { error: "Unable to load current profile" });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for authenticated user" });
    }

    return jsonResponse(200, {
      success: true,
      profile
    });
  } catch (error) {
    console.error("[get-current-profile] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to load current profile" });
  }
});
