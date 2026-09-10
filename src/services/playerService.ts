import { AvailabilityStatus, PlayStyleTag, Profile } from "@/core/types/models";
import { Database } from "@/types/database";
import { DEFAULT_LAUNCH_SPORT, getSportIdBySlug, isSportEnabled } from "@/config/sports";
import { debugLog } from "@/shared/lib/logger";

import { getAuthenticatedRequestHeaders } from "./authSession";

type SkillLevel = Database["public"]["Enums"]["skill_level"];
type SportSlug = Database["public"]["Enums"]["sport_slug"];

export type NearbyPlayerFilters = {
  sport?: SportSlug;
  skillLevel?: SkillLevel;
  maxDistanceKm?: number;
  area?: string;
  availability?: AvailabilityStatus;
};

export type NearbyPlayer = {
  id: string;
  username: string;
  displayName: string;
  vancouverArea: string;
  availabilityStatus: AvailabilityStatus;
  sports: Profile["sports"];
  playStyleTags: PlayStyleTag[];
  matchesPlayed: number;
  distanceKm: number;
};

export type SuggestedOpponent = NearbyPlayer & {
  matchedSport: SportSlug;
  matchedSkillLevel?: SkillLevel;
  sportId: number;
  reason: string;
};

type NearbyPlayerResponse = {
  id: string;
  username?: string | null;
  displayName?: string | null;
  vancouverArea: string;
  availabilityStatus: AvailabilityStatus;
  sports: Profile["sports"];
  matchesPlayed: number;
  distanceKm: number;
};

type NearbyPlayersResponse = {
  error?: string;
  players?: NearbyPlayerResponse[];
};

function getDiscoveryName(primary?: string | null, secondary?: string | null) {
  return primary?.trim() || secondary?.trim() || "Player";
}

export async function getNearbyPlayers({
  sport,
  availability,
  skillLevel,
  maxDistanceKm,
  area
}: NearbyPlayerFilters = {}): Promise<NearbyPlayer[]> {
  if (sport && !isSportEnabled(sport)) {
    return [];
  }

  if (availability === "unavailable") {
    return [];
  }

  const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseProjectUrl) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authHeaders = await getAuthenticatedRequestHeaders();
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/get-nearby-players`, {
    method: "POST",
    headers: {
      ...authHeaders,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sport: sport ?? DEFAULT_LAUNCH_SPORT,
      availability: availability ?? "this_week"
    })
  });
  const payload = (await response.json().catch(() => null)) as NearbyPlayersResponse | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Nearby player lookup failed with status ${response.status}`);
  }

  if (!payload?.players) {
    throw new Error("Nearby player response did not include players.");
  }

  return payload.players
    .map((player) => {
      const username = getDiscoveryName(player.username, player.displayName);
      const displayName = getDiscoveryName(player.displayName, player.username);

      return {
        ...player,
        username,
        displayName,
        playStyleTags: []
      };
    })
    .filter((player) => maxDistanceKm === undefined || player.distanceKm <= maxDistanceKm)
    .filter((player) => !area || player.vancouverArea === area)
    .filter((player) => !skillLevel || player.sports.some((entry) => entry.skillLevel === skillLevel));
}

export function getLoopOneNearbyPlayers(
  filters: Pick<NearbyPlayerFilters, "sport" | "availability">
): Promise<NearbyPlayer[]> {
  return getNearbyPlayers(filters);
}

export async function getSuggestedOpponents({
  sport = DEFAULT_LAUNCH_SPORT,
  availability = "today",
  limit = 5
}: Pick<NearbyPlayerFilters, "sport" | "availability"> & { limit?: number } = {}): Promise<SuggestedOpponent[]> {
  const nearbyPlayers = await getNearbyPlayers({ sport, availability });
  const availabilityOrder: AvailabilityStatus[] = ["now", "today", "this_week", "unavailable"];
  const suggestedPlayers = nearbyPlayers
    .sort((left, right) => {
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
      matchedSport: sport,
      matchedSkillLevel: player.sports.find((entry) => entry.sport === sport)?.skillLevel,
      sportId: getSportIdBySlug(sport) as number,
      reason: player.availabilityStatus === "now" ? "Ready now" : "Good match"
    }));

  debugLog("[playerService] suggested opponents ready", {
    selectedSportId: getSportIdBySlug(sport) ?? null,
    selectedSport: sport,
    nearbyCount: nearbyPlayers.length,
    filteredResults: suggestedPlayers.length
  });

  return suggestedPlayers;
}
