import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authUserId = await getAuthenticatedUserId(request);
    const query = new URL(request.url).searchParams.get("query")?.trim().replace(/[%_]/g, "") ?? "";

    if (query.length < 2) {
      return jsonResponse(200, { profiles: [] });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (currentProfileError) {
      return jsonResponse(500, { error: currentProfileError.message });
    }

    if (!currentProfile) {
      return jsonResponse(404, { error: "Profile not found for authenticated user" });
    }

    const { data: profiles, error: searchError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        vancouver_area,
        availability_status,
        profile_stats(matches_played),
        profile_sports(skill_level, is_active, sports(slug))
      `)
      .eq("onboarding_completed", true)
      .neq("id", currentProfile.id)
      .ilike("username", `%${query}%`)
      .order("username", { ascending: true })
      .limit(20);

    if (searchError) {
      console.error("[search-profiles] profile search failed", {
        authUserId,
        profileId: currentProfile.id,
        query,
        error: searchError
      });
      return jsonResponse(500, { error: searchError.message });
    }

    return jsonResponse(200, { profiles: profiles ?? [] });
  } catch (error) {
    console.error("[search-profiles] unexpected failure", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown profile search error"
    });
  }
});
