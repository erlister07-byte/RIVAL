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

const supportedSports = {
  pickleball: 3
} as const;

const availabilityValues = ["now", "today", "this_week"] as const;

const vancouverAreaCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Downtown: { latitude: 49.2827, longitude: -123.1207 },
  Kitsilano: { latitude: 49.2681, longitude: -123.1686 },
  "Mount Pleasant": { latitude: 49.2626, longitude: -123.1007 },
  "East Vancouver": { latitude: 49.2752, longitude: -123.1007 },
  "West End": { latitude: 49.2877, longitude: -123.1323 },
  "North Vancouver": { latitude: 49.3201, longitude: -123.1323 },
  Burnaby: { latitude: 49.2488, longitude: -122.9805 },
  Richmond: { latitude: 49.1666, longitude: -123.1336 },
  Surrey: { latitude: 49.1913, longitude: -122.849 },
  "New Westminster": { latitude: 49.2057, longitude: -123.1323 }
};

type NearbyPlayersRequest = {
  sport?: string;
  availability?: string;
};

type CandidateProfile = {
  id: string;
  username: string;
  display_name: string;
  vancouver_area: string;
  availability_status: "now" | "today" | "this_week" | "unavailable" | null;
  profile_sports: Array<{
    skill_level: "beginner" | "intermediate" | "advanced" | "competitive";
    is_active: boolean;
    sports: {
      slug: keyof typeof supportedSports;
    } | null;
  }> | null;
  profile_stats:
    | {
        wins: number | null;
        losses: number | null;
        matches_played: number | null;
      }
    | Array<{
        wins: number | null;
        losses: number | null;
        matches_played: number | null;
      }>
    | null;
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

function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}

function calculateDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const deltaLatitude = degreesToRadians(to.latitude - from.latitude);
  const deltaLongitude = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Number((earthRadiusKm * arc).toFixed(1));
}

function getAvailabilityValues(availability: typeof availabilityValues[number]) {
  if (availability === "now") {
    return ["now"];
  }

  if (availability === "today") {
    return ["now", "today"];
  }

  return ["now", "today", "this_week"];
}

function getStats(profileStats: CandidateProfile["profile_stats"]) {
  return Array.isArray(profileStats) ? profileStats[0] ?? null : profileStats;
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

    const requestBody = await request.json().catch(() => null);

    if (
      !requestBody ||
      typeof requestBody !== "object" ||
      Array.isArray(requestBody) ||
      Object.keys(requestBody).some((key) => key !== "sport" && key !== "availability")
    ) {
      return jsonResponse(400, { error: "Invalid nearby player filters" });
    }

    const filters = requestBody as NearbyPlayersRequest;
    const sport = filters.sport;
    const availability = filters.availability;

    if (!sport || !(sport in supportedSports)) {
      return jsonResponse(400, { error: "Unsupported sport" });
    }

    if (!availability || !availabilityValues.includes(availability as typeof availabilityValues[number])) {
      return jsonResponse(400, { error: "Unsupported availability" });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, onboarding_completed, vancouver_area, challenge_radius_km")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (callerProfileError) {
      console.error("[get-nearby-players] caller profile lookup failed", { error: callerProfileError });
      return jsonResponse(500, { error: "Unable to resolve current profile" });
    }

    if (!callerProfile) {
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
    }

    const callerCoordinates = vancouverAreaCoordinates[callerProfile.vancouver_area];

    if (
      !callerProfile.onboarding_completed ||
      !callerCoordinates ||
      !Number.isFinite(callerProfile.challenge_radius_km) ||
      callerProfile.challenge_radius_km < 1 ||
      callerProfile.challenge_radius_km > 100
    ) {
      return jsonResponse(422, { error: "Profile is not ready for discovery" });
    }

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        vancouver_area,
        availability_status,
        profile_sports!inner(skill_level, is_active, sports!inner(slug)),
        profile_stats(profile_id, wins, losses, matches_played)
      `)
      .eq("onboarding_completed", true)
      .neq("id", callerProfile.id)
      .eq("profile_sports.sport_id", supportedSports[sport as keyof typeof supportedSports])
      .eq("profile_sports.is_active", true)
      .in("availability_status", getAvailabilityValues(availability as typeof availabilityValues[number]));

    if (candidatesError) {
      console.error("[get-nearby-players] candidate lookup failed", { error: candidatesError });
      return jsonResponse(500, { error: "Unable to load nearby players" });
    }

    const players = ((candidates ?? []) as CandidateProfile[])
      .flatMap((candidate) => {
        const candidateCoordinates = vancouverAreaCoordinates[candidate.vancouver_area];

        if (!candidateCoordinates) {
          return [];
        }

        const distanceKm = calculateDistanceKm(callerCoordinates, candidateCoordinates);

        if (distanceKm > callerProfile.challenge_radius_km) {
          return [];
        }

        const stats = getStats(candidate.profile_stats);
        const sports = (candidate.profile_sports ?? [])
          .filter((profileSport) => profileSport.is_active && profileSport.sports?.slug === sport)
          .map((profileSport) => ({
            sport: profileSport.sports?.slug,
            skillLevel: profileSport.skill_level
          }));

        if (sports.length === 0) {
          return [];
        }

        return [{
          id: candidate.id,
          username: candidate.username,
          displayName: candidate.display_name,
          vancouverArea: candidate.vancouver_area,
          availabilityStatus: candidate.availability_status ?? "unavailable",
          sports,
          wins: stats?.wins ?? 0,
          losses: stats?.losses ?? 0,
          matchesPlayed: stats?.matches_played ?? 0,
          distanceKm
        }];
      });

    return jsonResponse(200, { success: true, players });
  } catch (error) {
    console.error("[get-nearby-players] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to load nearby players" });
  }
});
