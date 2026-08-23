import { getAuthenticatedUser } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

type UpsertProfileRequest = {
  email?: string;
  displayName?: string;
  vancouverArea?: string;
  challengeRadiusKm?: number;
  availabilityStatus?: "now" | "today" | "this_week" | "unavailable";
  latitude?: number | null;
  longitude?: number | null;
  onboardingCompleted?: boolean;
  sports?: Array<{
    sportId: number;
    skillLevel: "beginner" | "intermediate" | "advanced" | "competitive";
  }>;
};

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

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFriendlyProfileError(error: { message?: string; code?: string; details?: string | null }) {
  const matchesUsernameConstraint =
    error.message?.includes("profiles_username_key")
    || error.details?.includes("profiles_username_key")
    || error.code === "23505";

  if (matchesUsernameConstraint) {
    return "That username is already taken. Please choose another.";
  }

  return error.message ?? "Profile upsert failed.";
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
    latitude,
    longitude,
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

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authUser = await getAuthenticatedUser(request);
    const authUserId = authUser.id;
    const supabaseAdmin = createSupabaseAdmin();

    if (request.method === "GET") {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select(getProfileSelect())
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (profileError) {
        console.error("[upsert-profile] profile lookup failed", {
          authUserId,
          error: profileError
        });
        return jsonResponse(500, { error: profileError.message });
      }

      return jsonResponse(200, {
        success: true,
        profile
      });
    }

    const requestBody = (await request.json().catch(() => ({}))) as UpsertProfileRequest;

    const displayName = sanitizeString(requestBody.displayName);
    const vancouverArea = sanitizeString(requestBody.vancouverArea);
    const email = sanitizeString(authUser.email);

    if (!displayName) {
      return jsonResponse(400, { error: "Missing displayName" });
    }

    if (!vancouverArea) {
      return jsonResponse(400, { error: "Missing vancouverArea" });
    }

    if (typeof requestBody.challengeRadiusKm !== "number") {
      return jsonResponse(400, { error: "Missing challengeRadiusKm" });
    }

    const profilePayload = {
      auth_user_id: authUserId,
      // Keep the legacy identity column synchronized until the old SQL RPCs
      // are removed in a follow-up schema cleanup.
      firebase_uid: authUserId,
      email: email || null,
      display_name: displayName,
      username: displayName,
      vancouver_area: vancouverArea,
      challenge_radius_km: requestBody.challengeRadiusKm,
      availability_status: requestBody.availabilityStatus ?? "unavailable",
      latitude: requestBody.latitude ?? null,
      longitude: requestBody.longitude ?? null,
      onboarding_completed: requestBody.onboardingCompleted ?? false
    };

    const { data: existingProfile } = email
      ? await supabaseAdmin.from("profiles").select("id, auth_user_id").eq("email", email).maybeSingle()
      : { data: null };

    if (existingProfile?.auth_user_id && existingProfile.auth_user_id !== authUserId) {
      return jsonResponse(409, { error: "That email is already linked to another account." });
    }

    const profileMutation = existingProfile
      ? supabaseAdmin.from("profiles").update(profilePayload).eq("id", existingProfile.id)
      : supabaseAdmin.from("profiles").upsert(profilePayload, { onConflict: "auth_user_id" });

    const { data: profile, error: profileError } = await profileMutation
      .select("id")
      .single();

    if (profileError) {
      console.error("[upsert-profile] profile upsert failed", {
        authUserId,
        error: profileError
      });
      return jsonResponse(409, { error: getFriendlyProfileError(profileError) });
    }

    if (!profile) {
      return jsonResponse(500, { error: "Profile not found after upsert" });
    }

    if (requestBody.sports?.length) {
      const sportsPayload = requestBody.sports.map((sport) => ({
        profile_id: profile.id,
        sport_id: sport.sportId,
        skill_level: sport.skillLevel,
        is_active: true
      }));

      const { error: sportsError } = await supabaseAdmin
        .from("profile_sports")
        .upsert(sportsPayload, { onConflict: "profile_id,sport_id" });

      if (sportsError) {
        console.error("[upsert-profile] profile sports upsert failed", {
          authUserId,
          profileId: profile.id,
          error: sportsError
        });
        return jsonResponse(500, { error: sportsError.message });
      }
    }

    const { data: hydratedProfile, error: hydratedProfileError } = await supabaseAdmin
      .from("profiles")
      .select(getProfileSelect())
      .eq("id", profile.id)
      .single();

    if (hydratedProfileError) {
      console.error("[upsert-profile] hydrated profile lookup failed", {
        authUserId,
        profileId: profile.id,
        error: hydratedProfileError
      });
      return jsonResponse(500, { error: hydratedProfileError.message });
    }

    return jsonResponse(200, {
      success: true,
      profile: hydratedProfile
    });
  } catch (error) {
    console.error("[upsert-profile] unexpected failure", error);

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown upsert profile error"
    });
  }
});
