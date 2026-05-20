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

function shouldRetryWithoutStakeColumns(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";

  return error?.code === "PGRST204" || message.includes("stake_type") || message.includes("stake_label");
}

function mapChallengeResponse(row: {
  id: string;
  sport_id: number;
  challenger_profile_id: string;
  opponent_profile_id: string | null;
  scheduled_at: string;
  location_name: string;
  challenge_type: "casual" | "practice" | "ranked";
  stake_type?: string | null;
  stake_label?: string | null;
  stake_note?: string | null;
  status: "pending" | "accepted" | "declined" | "completed" | "canceled";
  created_at: string;
  is_open: boolean;
  sports?: {
    slug: string;
  } | null;
}) {
  return {
    id: row.id,
    sport_id: row.sport_id,
    challenger_profile_id: row.challenger_profile_id,
    opponent_profile_id: row.opponent_profile_id,
    scheduled_at: row.scheduled_at,
    location_name: row.location_name,
    challenge_type: row.challenge_type,
    stake_type: row.stake_type ?? "bragging_rights",
    stake_label: row.stake_label ?? "Bragging Rights",
    stake_note: row.stake_note ?? null,
    status: row.status,
    created_at: row.created_at,
    is_open: row.is_open,
    sports: row.sports ? { slug: row.sports.slug } : null
  };
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
      stakeType?: string | null;
      stakeLabel?: string | null;
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

    const insertPayload = {
      sport_id: requestBody.sportId,
      challenger_profile_id: profile.id,
      opponent_profile_id: null,
      challenge_type: requestBody.challengeType,
      stake_type: requestBody.stakeType?.trim() ? requestBody.stakeType.trim() : "bragging_rights",
      stake_label: requestBody.stakeLabel?.trim() ? requestBody.stakeLabel.trim() : "Bragging Rights",
      stake_note: requestBody.stakeNote?.trim() ? requestBody.stakeNote.trim() : null,
      scheduled_at: requestBody.scheduledAt,
      location_name: requestBody.locationName.trim(),
      status: "pending",
      is_open: true
    };

    const fullSelect =
      "id, sport_id, challenger_profile_id, opponent_profile_id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, status, created_at, is_open, sports!inner(slug)";
    const fallbackSelect =
      "id, sport_id, challenger_profile_id, opponent_profile_id, scheduled_at, location_name, challenge_type, stake_note, status, created_at, is_open, sports!inner(slug)";

    let { data: challenge, error: createError } = await supabaseAdmin
      .from("challenges")
      .insert(insertPayload)
      .select(fullSelect)
      .single();

    if (createError && shouldRetryWithoutStakeColumns(createError)) {
      const fallbackInsertPayload = {
        sport_id: requestBody.sportId,
        challenger_profile_id: profile.id,
        opponent_profile_id: null,
        challenge_type: requestBody.challengeType,
        stake_note: requestBody.stakeNote?.trim() ? requestBody.stakeNote.trim() : null,
        scheduled_at: requestBody.scheduledAt,
        location_name: requestBody.locationName.trim(),
        status: "pending",
        is_open: true
      };

      ({ data: challenge, error: createError } = await supabaseAdmin
        .from("challenges")
        .insert(fallbackInsertPayload)
        .select(fallbackSelect)
        .single());
    }

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
      challenge: mapChallengeResponse(challenge)
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown create open challenge error"
    });
  }
});
