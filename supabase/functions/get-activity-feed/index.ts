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

if (!firebaseProjectId) {
  throw new Error("Missing FIREBASE_PROJECT_ID");
}

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

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
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Firebase bearer token");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

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
    const requestBody = (await request.json().catch(() => ({}))) as {
      profileId?: string;
      limit?: number;
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, firebase_uid")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (profileError) {
      console.error("[get-activity-feed] profile lookup failed", {
        firebaseUid,
        error: profileError
      });
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
    }

    if (typeof requestBody.profileId === "string" && requestBody.profileId !== profile.id) {
      return jsonResponse(403, { error: "Profile mismatch" });
    }

    const limit = Math.min(Math.max(requestBody.limit ?? 25, 1), 100);

    console.log("[get-activity-feed] verified feed request", {
      firebaseUid,
      profileId: profile.id,
      limit
    });

    const { data: feedRows, error: feedError } = await supabaseAdmin
      .from("activity_events")
      .select("id, actor_profile_id, target_profile_id, challenge_id, match_id, event_type, metadata, created_at, sports(slug)")
      .or(`actor_profile_id.eq.${profile.id},target_profile_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (feedError) {
      console.error("[get-activity-feed] feed query failed", {
        firebaseUid,
        profileId: profile.id,
        error: feedError
      });
      return jsonResponse(500, { error: feedError.message });
    }

    const feed = (feedRows ?? []).map((row) => ({
      id: row.id,
      actor_profile_id: row.actor_profile_id,
      target_profile_id: row.target_profile_id,
      challenge_id: row.challenge_id,
      match_id: row.match_id,
      sport_slug: row.sports?.slug ?? null,
      event_type: row.event_type,
      metadata: row.metadata,
      created_at: row.created_at
    }));

    console.log("[get-activity-feed] feed load succeeded", {
      firebaseUid,
      profileId: profile.id,
      rowCount: feed.length
    });

    return jsonResponse(200, {
      success: true,
      profileId: profile.id,
      feed
    });
  } catch (error) {
    console.error("[get-activity-feed] unexpected failure", error);

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown feed error"
    });
  }
});
