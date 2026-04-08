import { AvailabilityStatus, Profile, matchesAvailabilityIntent } from "@/core/types/models";
import { Database } from "@/types/database";
import { DEFAULT_LAUNCH_SPORT, getSportConfigById, getSportIdBySlug, isSportEnabled } from "@/config/sports";
import { debugError, debugLog } from "@/shared/lib/logger";

import { getUserProfile } from "./userService";
import { supabase } from "./supabaseClient";

type SkillLevel = Database["public"]["Enums"]["skill_level"];
type SportSlug = Database["public"]["Enums"]["sport_slug"];

export type NearbyPlayerFilters = {
  sport?: SportSlug;
  skillLevel?: SkillLevel;
  maxDistanceKm?: number;
  area?: string;
  availability?: AvailabilityStatus;
};

export type NearbyPlayer = Profile & {
  distanceKm: number;
};

export type SuggestedOpponent = NearbyPlayer & {
  matchedSport: SportSlug;
  matchedSkillLevel?: SkillLevel;
  sportId: number;
  reason: string;
};

type ActivityRow = {
  id: string;
  updated_at: string;
};

export async function getPickleballPlayers(currentProfileId: string): Promise<Profile[]> {
  const pickleballSportId = getSportIdBySlug(DEFAULT_LAUNCH_SPORT);

  if (!pickleballSportId) {
    return [];
  }

  debugLog("[playerService] loading pickleball players", {
    currentProfileId,
    sportId: pickleballSportId
  });

  const { data, error } = await supabase
    .from("profile_sports")
    .select("profile_id")
    .eq("sport_id", pickleballSportId)
    .eq("is_active", true)
    .neq("profile_id", currentProfileId);

  if (error) {
    debugError("[playerService] failed to load pickleball player ids", error, {
      currentProfileId,
      sportId: pickleballSportId
    });
    throw error;
  }

  const players = await Promise.all(
    (data ?? []).map((row) => getUserProfile({ profileId: row.profile_id }))
  );

  return players
    .filter((player): player is Profile => Boolean(player))
    .filter((player) => player.id !== currentProfileId)
    .filter((player) => player.sports.some((sport) => sport.sport === DEFAULT_LAUNCH_SPORT))
    .sort((left, right) => left.username.localeCompare(right.username));
}

const VANCOUVER_AREA_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  Downtown: { latitude: 49.2827, longitude: -123.1207 },
  Kitsilano: { latitude: 49.2681, longitude: -123.1686 },
  "Mount Pleasant": { latitude: 49.2626, longitude: -123.1007 },
  "East Vancouver": { latitude: 49.2752, longitude: -123.0653 },
  "West End": { latitude: 49.2877, longitude: -123.1323 },
  "North Vancouver": { latitude: 49.3201, longitude: -123.0724 },
  Burnaby: { latitude: 49.2488, longitude: -122.9805 },
  Richmond: { latitude: 49.1666, longitude: -123.1336 },
  Surrey: { latitude: 49.1913, longitude: -122.849 },
  "New Westminster": { latitude: 49.2057, longitude: -122.911 }
};

function getProfileCoordinates(profile: Profile) {
  return VANCOUVER_AREA_COORDINATES[profile.vancouverArea] ?? VANCOUVER_AREA_COORDINATES.Downtown;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
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
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Number((earthRadiusKm * arc).toFixed(1));
}

export async function getNearbyPlayers(
  currentProfileId: string,
  filters: NearbyPlayerFilters = {}
): Promise<NearbyPlayer[]> {
  debugLog("[playerService] loading nearby players", {
    currentProfileId,
    filters
  });

  const currentProfile = await getUserProfile({ profileId: currentProfileId });

  if (!currentProfile) {
    throw new Error("Current user profile is required for player discovery.");
  }

  const currentCoordinates = getProfileCoordinates(currentProfile);
  const liveSportFilter = filters.sport && isSportEnabled(filters.sport) ? filters.sport : undefined;

  if (filters.sport && !liveSportFilter) {
    return [];
  }

  let query = supabase
    .from("profiles")
    .select("id")
    .neq("id", currentProfileId)
    .eq("onboarding_completed", true);

  if (filters.area) {
    query = query.eq("vancouver_area", filters.area);
  }

  const { data: profileIds, error } = await query;

  if (error) {
    debugError("[playerService] failed to load nearby player ids", error, {
      currentProfileId,
      filters
    });
    throw error;
  }

  const players = await Promise.all(
    (profileIds ?? []).map((item) => getUserProfile({ profileId: item.id }))
  );

  return players
    .filter((player): player is Profile => Boolean(player))
    .filter((player) => player.id !== currentProfile.id)
    .filter((player) => {
      const distanceKm = calculateDistanceKm(currentCoordinates, getProfileCoordinates(player));
      const withinDistance = filters.maxDistanceKm === undefined || distanceKm <= filters.maxDistanceKm;

      const liveSports = player.sports.filter((sport) => isSportEnabled(sport.sport));
      const matchesAvailability = matchesAvailabilityIntent(player.availabilityStatus, filters.availability);

      const matchesSport =
        liveSportFilter === undefined ||
        liveSports.some((sport) => sport.sport === liveSportFilter);

      const matchesSkill =
        filters.skillLevel === undefined ||
        liveSports.some((sport) => sport.skillLevel === filters.skillLevel);

      return liveSports.length > 0 && withinDistance && matchesSport && matchesSkill && matchesAvailability;
    })
    .map((player) => ({
      ...player,
      sports: player.sports.filter((sport) => isSportEnabled(sport.sport)),
      distanceKm: calculateDistanceKm(currentCoordinates, getProfileCoordinates(player))
    }));
}

export async function getSuggestedOpponents(
  currentProfileId: string,
  selectedSportId?: number,
  limit = 5
): Promise<SuggestedOpponent[]> {
  const currentProfile = await getUserProfile({ profileId: currentProfileId });

  if (!currentProfile) {
    throw new Error("Current user profile is required for matchmaking suggestions.");
  }

  const selectedSport =
    (selectedSportId ? getSportConfigById(selectedSportId)?.slug : undefined) ??
    currentProfile.sports.find((sport) => isSportEnabled(sport.sport))?.sport ??
    DEFAULT_LAUNCH_SPORT;

  if (!selectedSport || !isSportEnabled(selectedSport)) {
    return [];
  }

  const strictNearbyPlayers = await getNearbyPlayers(currentProfileId, {
    sport: selectedSport,
    maxDistanceKm: currentProfile.challengeRadiusKm,
    availability: currentProfile.availabilityStatus === "unavailable" ? "today" : currentProfile.availabilityStatus
  });

  const fallbackRadiusKm = Math.min(Math.max(currentProfile.challengeRadiusKm * 2, currentProfile.challengeRadiusKm), 50);
  const fallbackNearbyPlayers =
    strictNearbyPlayers.length >= limit
      ? []
      : await getNearbyPlayers(currentProfileId, {
          sport: selectedSport,
          maxDistanceKm: fallbackRadiusKm,
          availability: currentProfile.availabilityStatus === "unavailable" ? "today" : currentProfile.availabilityStatus
        });

  const mergedPlayers = Array.from(
    new Map(
      [...strictNearbyPlayers, ...fallbackNearbyPlayers].map((player) => [player.id, player])
    ).values()
  );

  if (mergedPlayers.length === 0) {
    return [];
  }

  const { data: activityRows, error: activityError } = await supabase
    .from("profiles")
    .select("id, updated_at")
    .in(
      "id",
      mergedPlayers.map((player) => player.id)
    );

  if (activityError) {
    throw activityError;
  }

  const lastActiveById = new Map(
    ((activityRows ?? []) as ActivityRow[]).map((row) => [row.id, new Date(row.updated_at).getTime()])
  );

  return mergedPlayers
    .sort((left, right) => {
      const activityDelta = (lastActiveById.get(right.id) ?? 0) - (lastActiveById.get(left.id) ?? 0);
      if (activityDelta !== 0) {
        return activityDelta;
      }

      const availabilityOrder = ["now", "today", "this_week", "unavailable"];
      const availabilityDelta =
        availabilityOrder.indexOf(left.availabilityStatus) - availabilityOrder.indexOf(right.availabilityStatus);

      if (availabilityDelta !== 0) {
        return availabilityDelta;
      }

      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }

      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, limit)
    .map((player) => ({
      ...player,
      matchedSport: selectedSport,
      matchedSkillLevel: player.sports.find((sport) => sport.sport === selectedSport)?.skillLevel,
      sportId: getSportIdBySlug(selectedSport) as number,
      reason:
        (lastActiveById.get(player.id) ?? 0) > Date.now() - 1000 * 60 * 60 * 24 * 14
          ? "Recently active"
          : "Good match"
    }));
}
