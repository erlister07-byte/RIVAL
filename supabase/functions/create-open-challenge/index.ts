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
    console.log("[create-open-challenge] request received", {
      method: request.method,
      hasAuthorization: Boolean(request.headers.get("Authorization")),
      timestamp: new Date().toISOString()
    });

    const payload = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = getFirebaseUid(payload);
    console.log("[create-open-challenge] firebase token verified", {
      firebaseUid
    });

    const supabaseAdmin = createSupabaseAdmin();
    const requestBody = (await request.json().catch(() => ({}))) as {
      sportId?: number;
      scheduledAt?: string;
      locationName?: string;
      challengeType?: "casual" | "practice" | "ranked";
      stakeNote?: string | null;
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, firebase_uid")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (profileError) {
      console.error("[create-open-challenge] profile lookup failed", {
        firebaseUid,
        error: profileError
      });
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile) {
      console.warn("[create-open-challenge] profile not found", {
        firebaseUid
      });
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
    }

    console.log("[create-open-challenge] profile resolved", {
      firebaseUid,
      profileId: profile.id
    });

    if (
      typeof requestBody.sportId !== "number" ||
      !requestBody.scheduledAt ||
      !requestBody.locationName ||
      !requestBody.challengeType
    ) {
      return jsonResponse(400, { error: "Missing required open challenge fields" });
    }

    const { data: challenge, error: createError } = await supabaseAdmin
      .from("challenges")
      .insert({
        sport_id: requestBody.sportId,
        challenger_profile_id: profile.id,
        opponent_profile_id: null,
        challenge_type: requestBody.challengeType,
        stake_note: requestBody.stakeNote?.trim() ? requestBody.stakeNote.trim() : null,
        scheduled_at: requestBody.scheduledAt,
        location_name: requestBody.locationName.trim(),
        status: "pending",
        is_open: true
      })
      .select("id")
      .single();

    if (createError) {
      console.error("[create-open-challenge] insert failed", {
        profileId: profile.id,
        sportId: requestBody.sportId,
        error: createError
      });
      return jsonResponse(500, { error: createError.message });
    }

    console.log("[create-open-challenge] insert succeeded", {
      profileId: profile.id,
      challengeId: challenge.id
    });

    return jsonResponse(200, {
      success: true,
      challengeId: challenge.id
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown create open challenge error"
    });
  }
});
