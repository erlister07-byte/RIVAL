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

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const payload = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = getFirebaseUid(payload);
    const supabaseAdmin = createSupabaseAdmin();
    const requestBody = (await request.json().catch(() => ({}))) as {
      challengeId?: string;
    };

    if (!requestBody.challengeId) {
      return jsonResponse(400, { error: "Missing challenge id" });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, firebase_uid")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
    }

    const { data: acceptedRows, error: acceptError } = await supabaseAdmin
      .from("challenges")
      .update({
        opponent_profile_id: profile.id,
        status: "accepted",
        accepted_at: new Date().toISOString()
      })
      .eq("id", requestBody.challengeId)
      .eq("is_open", true)
      .eq("status", "pending")
      .is("opponent_profile_id", null)
      .neq("challenger_profile_id", profile.id)
      .select("id");

    if (acceptError) {
      return jsonResponse(500, { error: acceptError.message });
    }

    const acceptedChallenge = acceptedRows?.[0];
    if (acceptedChallenge?.id) {
      return jsonResponse(200, {
        success: true,
        challengeId: acceptedChallenge.id
      });
    }

    const { data: existingChallenge, error: existingError } = await supabaseAdmin
      .from("challenges")
      .select("id, challenger_profile_id, is_open, status, opponent_profile_id")
      .eq("id", requestBody.challengeId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse(500, { error: existingError.message });
    }

    if (!existingChallenge) {
      return jsonResponse(404, { error: "Challenge not found." });
    }

    if (existingChallenge.challenger_profile_id === profile.id) {
      return jsonResponse(403, { error: "You cannot accept your own open challenge." });
    }

    if (!existingChallenge.is_open) {
      return jsonResponse(400, { error: "This challenge is not open." });
    }

    if (existingChallenge.status !== "pending" || existingChallenge.opponent_profile_id) {
      return jsonResponse(409, { error: "This open challenge is no longer available." });
    }

    return jsonResponse(500, { error: "Unable to accept this open challenge." });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown accept open challenge error"
    });
  }
});
