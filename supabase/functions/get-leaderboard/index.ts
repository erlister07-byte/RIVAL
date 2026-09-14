import { createClient } from "npm:@supabase/supabase-js@2";

import { getAuthenticatedUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const maximumLeaderboardEntries = 500;

type LeaderboardRequest = {
  sport?: unknown;
};

type ProfileStats = {
  matches_played: number | null;
};

type LeaderboardProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  profile_stats: ProfileStats | ProfileStats[] | null;
};

type LeaderboardSourceRow = {
  profile_id: string;
  profiles: LeaderboardProfile | LeaderboardProfile[] | null;
};

type RankedLeaderboardEntry = {
  rank: number;
  profileId: string;
  displayName: string;
  username: string;
  matchesPlayed: number;
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

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function safeMatchesPlayed(profileStats: LeaderboardProfile["profile_stats"]) {
  const value = one(profileStats)?.matches_played;

  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function compareDisplayNames(left: string, right: string) {
  return left.normalize("NFKC").localeCompare(right.normalize("NFKC"), "en", {
    sensitivity: "base"
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let authUserId: string;

  try {
    authUserId = await getAuthenticatedUserId(request);
  } catch {
    return jsonResponse(401, { error: "Authentication required" });
  }

  try {
    const requestBody = await request.json().catch(() => null);

    if (
      !requestBody
      || typeof requestBody !== "object"
      || Array.isArray(requestBody)
      || Object.keys(requestBody).length !== 1
      || !("sport" in requestBody)
    ) {
      return jsonResponse(400, { error: "Invalid leaderboard request" });
    }

    const requestedSport = (requestBody as LeaderboardRequest).sport;
    const sportSlug = typeof requestedSport === "string" ? requestedSport.trim().toLowerCase() : "";

    if (!sportSlug) {
      return jsonResponse(400, { error: "A sport is required" });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, onboarding_completed")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (callerProfileError) {
      console.error("[get-leaderboard] caller profile lookup failed", { error: callerProfileError });
      return jsonResponse(500, { error: "Unable to resolve current profile" });
    }

    if (!callerProfile) {
      return jsonResponse(404, { error: "Profile not found for authenticated user" });
    }

    if (!callerProfile.onboarding_completed) {
      return jsonResponse(422, { error: "Complete onboarding before viewing the leaderboard" });
    }

    const { data: sport, error: sportError } = await supabaseAdmin
      .from("sports")
      .select("id, slug, name")
      .eq("slug", sportSlug)
      .maybeSingle();

    if (sportError) {
      console.error("[get-leaderboard] sport lookup failed", { sportSlug, error: sportError });
      return jsonResponse(500, { error: "Unable to resolve leaderboard sport" });
    }

    if (!sport) {
      return jsonResponse(400, { error: "Unsupported sport" });
    }

    const { data, error } = await supabaseAdmin
      .from("profile_sports")
      .select("profile_id, profiles!inner(id, username, display_name, profile_stats(matches_played))")
      .eq("sport_id", sport.id)
      .eq("is_active", true)
      .limit(maximumLeaderboardEntries + 1);

    if (error) {
      console.error("[get-leaderboard] leaderboard lookup failed", { sportSlug, error });
      return jsonResponse(500, { error: "Unable to load leaderboard" });
    }

    const sourceRows = (data ?? []) as LeaderboardSourceRow[];

    if (sourceRows.length > maximumLeaderboardEntries) {
      return jsonResponse(422, {
        error: "This leaderboard is too large to display as a complete list"
      });
    }

    const entries: RankedLeaderboardEntry[] = sourceRows
      .flatMap((row) => {
        const profile = one(row.profiles);

        if (!profile) {
          return [];
        }

        const profileId = profile.id || row.profile_id;
        const rawUsername = profile.username?.trim() ?? "";
        const rawDisplayName = profile.display_name?.trim() ?? "";
        const displayName = rawDisplayName || rawUsername || "Player";
        const username = rawUsername || displayName;

        return [{
          rank: 0,
          profileId,
          displayName,
          username,
          matchesPlayed: safeMatchesPlayed(profile.profile_stats)
        }];
      })
      .sort((left, right) => {
        if (left.matchesPlayed !== right.matchesPlayed) {
          return right.matchesPlayed - left.matchesPlayed;
        }

        const displayNameComparison = compareDisplayNames(left.displayName, right.displayName);

        return displayNameComparison || left.profileId.localeCompare(right.profileId);
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));

    return jsonResponse(200, {
      sport: {
        id: sport.id,
        slug: sport.slug,
        name: sport.name
      },
      entries
    });
  } catch (error) {
    console.error("[get-leaderboard] unexpected failure", { error });
    return jsonResponse(500, { error: "Unable to load leaderboard" });
  }
});
