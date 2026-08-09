import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
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

async function verifyFirebaseToken(authorizationHeader: string | null) {
  if (!firebaseProjectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID");
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Firebase bearer token");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  const firebaseJwks = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
  );
  const { payload } = await jwtVerify(token, firebaseJwks, {
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    audience: firebaseProjectId
  });

  return payload;
}

function getFirebaseUid(payload: JWTPayload) {
  if (typeof payload.user_id === "string") {
    return payload.user_id;
  }

  if (typeof payload.sub === "string") {
    return payload.sub;
  }

  throw new Error("Firebase token missing user id");
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
    const tokenPayload = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = getFirebaseUid(tokenPayload);
    const query = new URL(request.url).searchParams.get("query")?.trim().replace(/[%_]/g, "") ?? "";

    if (query.length < 2) {
      return jsonResponse(200, { profiles: [] });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (currentProfileError) {
      return jsonResponse(500, { error: currentProfileError.message });
    }

    if (!currentProfile) {
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
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
        firebaseUid,
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
