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

const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

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
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId
    });

    return payload;
  } catch {
    return null;
  }
}

function getFirebaseUid(payload: JWTPayload) {
  if (typeof payload.user_id === "string") {
    return payload.user_id;
  }

  if (typeof payload.sub === "string") {
    return payload.sub;
  }

  return null;
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
    firebase_uid,
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
    const tokenPayload = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = tokenPayload ? getFirebaseUid(tokenPayload) : null;

    if (!firebaseUid) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(getProfileSelect())
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (error) {
      console.error("[get-current-profile] profile lookup failed", { error });
      return jsonResponse(500, { error: "Unable to load current profile" });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
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
