import { PlayStyleTag, SkillLevel, SportSlug, normalizePlayStyleTags } from "@/core/types/models";
import { getSportConfig } from "@/config/sports";
import { Database } from "@/types/database";
import { debugError, debugLog } from "@/shared/lib/logger";
import { toServiceError } from "@/shared/lib/serviceError";

import { supabase } from "./supabaseClient";

type LiveSessionRow = Database["public"]["Tables"]["live_sessions"]["Row"];
type LiveSessionInsert = Database["public"]["Tables"]["live_sessions"]["Insert"];
type PlayLocationRow = Database["public"]["Tables"]["play_locations"]["Row"];
type LiveSessionStatus = "active" | "cancelled" | "expired";

type LiveSessionProfileSport = {
  is_active: boolean;
  skill_level: SkillLevel;
  sports: {
    slug: SportSlug;
  } | null;
};

type LiveSessionRowWithProfile = LiveSessionRow & {
  profiles: {
    id: string;
    username: string;
    display_name: string;
    vancouver_area: string;
    play_style_tags?: string[] | null;
    profile_sports?: LiveSessionProfileSport[] | null;
  } | null;
  play_locations?: PlayLocationRow | null;
};

export type PlayLocation = {
  id: string;
  sport: SportSlug;
  name: string;
  area?: string;
  latitude?: number;
  longitude?: number;
};

export type LiveSession = {
  id: string;
  profileId: string;
  username: string;
  displayName: string;
  vancouverArea: string;
  sport: SportSlug;
  sportName: string;
  locationId?: string;
  locationName: string;
  locationArea?: string;
  latitude?: number;
  longitude?: number;
  status: LiveSessionStatus;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  skillLevel?: SkillLevel;
  playStyleTags: PlayStyleTag[];
  matchesPlayed?: number;
};

type CreateLiveSessionInput = {
  profileId: string;
  sport: SportSlug;
  locationName: string;
  locationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const LIVE_SESSION_DURATION_MS = 90 * 60 * 1000;

const LIVE_SESSION_SELECT = `
  *,
  profiles!live_sessions_profile_id_fkey (
    id,
    username,
    display_name,
    vancouver_area,
    play_style_tags,
    profile_sports (
      is_active,
      skill_level,
      sports (
        slug
      )
    )
  ),
  play_locations!live_sessions_location_id_fkey (
    id,
    sport,
    name,
    area,
    latitude,
    longitude,
    is_active,
    created_at,
    updated_at
  )
`;

function getExpiryTimestamp() {
  return new Date(Date.now() + LIVE_SESSION_DURATION_MS).toISOString();
}

function mapPlayLocation(row: PlayLocationRow): PlayLocation {
  return {
    id: row.id,
    sport: row.sport as SportSlug,
    name: row.name,
    area: row.area ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined
  };
}

function mapLiveSession(row: LiveSessionRowWithProfile): LiveSession {
  const sport = row.sport as SportSlug;
  const sportConfig = getSportConfig(sport);
  const profileSport = row.profiles?.profile_sports?.find(
    (entry) => entry.is_active && entry.sports?.slug === sport
  );

  return {
    id: row.id,
    profileId: row.profile_id,
    username: row.profiles?.username ?? "player",
    displayName: row.profiles?.display_name ?? row.profiles?.username ?? "Player",
    vancouverArea: row.profiles?.vancouver_area ?? "",
    sport,
    sportName: sportConfig?.displayName ?? row.sport,
    locationId: row.location_id ?? row.play_locations?.id ?? undefined,
    locationName: row.play_locations?.name ?? row.location_name,
    locationArea: row.play_locations?.area ?? undefined,
    latitude: row.play_locations?.latitude ?? row.latitude ?? undefined,
    longitude: row.play_locations?.longitude ?? row.longitude ?? undefined,
    status: row.status as LiveSessionStatus,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    skillLevel: profileSport?.skill_level,
    playStyleTags: normalizePlayStyleTags(row.profiles?.play_style_tags)
  };
}

export async function getPlayLocationsBySport(sport: SportSlug): Promise<PlayLocation[]> {
  try {
    const { data, error } = await supabase
      .from("play_locations")
      .select("*")
      .eq("sport", sport)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as PlayLocationRow[]).map(mapPlayLocation);
  } catch (error) {
    debugError("[liveSessionService] failed to load play locations", error, {
      sport
    });
    throw toServiceError(error, "Unable to load courts right now.");
  }
}

export async function getCurrentUserLiveSession(profileId: string, sport?: SportSlug): Promise<LiveSession | null> {
  try {
    let query = supabase
      .from("live_sessions")
      .select(LIVE_SESSION_SELECT)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(1);

    if (sport) {
      query = query.eq("sport", sport);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapLiveSession(data as unknown as LiveSessionRowWithProfile) : null;
  } catch (error) {
    debugError("[liveSessionService] failed to load current live session", error, {
      profileId,
      sport: sport ?? null
    });
    throw toServiceError(error, "Unable to load live status right now.");
  }
}

export async function createLiveSession(input: CreateLiveSessionInput): Promise<LiveSession> {
  try {
    const existingSession = await getCurrentUserLiveSession(input.profileId, input.sport);
    const expiresAt = getExpiryTimestamp();

    if (existingSession) {
      const { data, error } = await supabase
        .from("live_sessions")
        .update({
          location_name: input.locationName,
          location_id: input.locationId ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          status: "active",
          expires_at: expiresAt
        })
        .eq("id", existingSession.id)
        .eq("profile_id", input.profileId)
        .select(LIVE_SESSION_SELECT)
        .single();

      if (error) {
        throw error;
      }

      return mapLiveSession(data as unknown as LiveSessionRowWithProfile);
    }

    const payload: LiveSessionInsert = {
      profile_id: input.profileId,
      sport: input.sport,
      location_name: input.locationName,
      location_id: input.locationId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      expires_at: expiresAt
    };

    const { data, error } = await supabase
      .from("live_sessions")
      .insert(payload)
      .select(LIVE_SESSION_SELECT)
      .single();

    if (error) {
      throw error;
    }

    debugLog("[liveSessionService] live session created", {
      profileId: input.profileId,
      sport: input.sport
    });

    return mapLiveSession(data as unknown as LiveSessionRowWithProfile);
  } catch (error) {
    debugError("[liveSessionService] failed to create live session", error, {
      profileId: input.profileId,
      sport: input.sport
    });
    throw toServiceError(error, "Unable to go live right now.");
  }
}

export async function getActiveLiveSessions(currentProfileId: string, sport?: SportSlug): Promise<LiveSession[]> {
  try {
    let query = supabase
      .from("live_sessions")
      .select(LIVE_SESSION_SELECT)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .neq("profile_id", currentProfileId)
      .order("updated_at", { ascending: false });

    if (sport) {
      query = query.eq("sport", sport);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ((data ?? []) as unknown as LiveSessionRowWithProfile[]).map(mapLiveSession);
  } catch (error) {
    debugError("[liveSessionService] failed to load active live sessions", error, {
      currentProfileId,
      sport: sport ?? null
    });
    throw toServiceError(error, "Unable to load live players right now.");
  }
}

export async function cancelLiveSession(sessionId: string, profileId: string): Promise<LiveSession> {
  try {
    const { data, error } = await supabase
      .from("live_sessions")
      .update({
        status: "cancelled"
      })
      .eq("id", sessionId)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .select(LIVE_SESSION_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return mapLiveSession(data as unknown as LiveSessionRowWithProfile);
  } catch (error) {
    debugError("[liveSessionService] failed to cancel live session", error, {
      sessionId,
      profileId
    });
    throw toServiceError(error, "Unable to end live status right now.");
  }
}
