import { AvailabilityStatus, PlayStyleTag, PlayerSummary, Profile, RecentMatch, normalizePlayStyleTags } from "@/core/types/models";
import { Database } from "@/types/database";
import { DEFAULT_LAUNCH_SPORT } from "@/config/sports";
import { isMissingColumnError, withOptionalFieldFallback } from "@/shared/lib/schemaDrift";
import { debugLog } from "@/shared/lib/logger";

import { mapPlayerSummary } from "./playerMapper";
import { supabase } from "./supabaseClient";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ProfileSportRow = Database["public"]["Tables"]["profile_sports"]["Row"];
type SportRow = Database["public"]["Tables"]["sports"]["Row"];
type ProfileStatsRow = Database["public"]["Tables"]["profile_stats"]["Row"];

export type CreateUserProfileInput = {
  firebaseUid: string;
  email: string;
  displayName: string;
  vancouverArea: string;
  challengeRadiusKm: number;
  availabilityStatus?: AvailabilityStatus;
  latitude?: number | null;
  longitude?: number | null;
  onboardingCompleted?: boolean;
  sports?: Array<{
    sportId: number;
    skillLevel: Database["public"]["Enums"]["skill_level"];
  }>;
};

export type UpdateUserProfileInput = {
  displayName?: string;
  vancouverArea?: string;
  challengeRadiusKm?: number;
  availabilityStatus?: AvailabilityStatus;
  latitude?: number | null;
  longitude?: number | null;
  onboardingCompleted?: boolean;
  playStyleTags?: PlayStyleTag[];
  sports?: Array<{
    sportId: number;
    skillLevel: Database["public"]["Enums"]["skill_level"];
    isActive?: boolean;
  }>;
};

type ProfileWithRelations = ProfileRow & {
  profile_sports: Array<
    ProfileSportRow & {
      sports: SportRow | null;
    }
  > | null;
  profile_stats: ProfileStatsRow | null;
};

type FriendSearchRow = {
  id: string;
  username: string;
  display_name: string;
  vancouver_area: string;
  availability_status?: string | null;
  profile_stats?:
    | {
        matches_played?: number | null;
      }
    | Array<{
        matches_played?: number | null;
      }>
    | null;
  profile_sports?:
    | Array<{
        skill_level: Database["public"]["Enums"]["skill_level"];
        is_active: boolean;
        sports?: {
          slug?: Database["public"]["Enums"]["sport_slug"] | null;
        } | null;
      }>
    | null;
  play_style_tags?: string[] | null;
};

export type FriendSearchResult = {
  id: string;
  username: string;
  displayName: string;
  vancouverArea: string;
  availabilityStatus: AvailabilityStatus;
  playStyleTags: PlayStyleTag[];
  matchesPlayed: number;
  primarySport?: Database["public"]["Enums"]["sport_slug"];
  primarySkillLevel?: Database["public"]["Enums"]["skill_level"];
};

function isMissingAvailabilityColumnError(error: unknown) {
  return isMissingColumnError(error, "availability_status");
}

function isMissingPlayStyleTagsColumnError(error: unknown) {
  return isMissingColumnError(error, "play_style_tags");
}

function getProfileSelect(includeAvailabilityStatus = true, includePlayStyleTags = true) {
  // Keep optional profile fields isolated here so a missing migration can retry cleanly
  // without breaking the rest of the profile payload.
  return `
      id,
      email,
      username,
      display_name,
      vancouver_area,
      challenge_radius_km,
      ${includeAvailabilityStatus ? "availability_status," : ""}
      ${includePlayStyleTags ? "play_style_tags," : ""}
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

function getFriendSearchSelect(includeAvailabilityStatus = true, includePlayStyleTags = true) {
  return `
      id,
      username,
      display_name,
      vancouver_area,
      ${includeAvailabilityStatus ? "availability_status," : ""}
      ${includePlayStyleTags ? "play_style_tags," : ""}
      profile_stats(matches_played),
      profile_sports(skill_level, is_active, sports(slug))
    `;
}

function mapProfile(row: ProfileWithRelations): Profile {
  const playerSummary = mapPlayerSummary(row);

  return {
    ...playerSummary,
    firebaseUid: undefined,
    email: row.email ?? "",
    vancouverArea: row.vancouver_area,
    challengeRadiusKm: row.challenge_radius_km,
    availabilityStatus: withOptionalFieldFallback(row.availability_status as AvailabilityStatus | null, "unavailable"),
    onboardingCompleted: row.onboarding_completed,
    playStyleTags: normalizePlayStyleTags(row.play_style_tags),
    sports:
      row.profile_sports?.flatMap((item) =>
        item.sports
          ? [
              {
                sport: item.sports.slug,
                skillLevel: item.skill_level
              }
            ]
          : []
      ) ?? [],
  };
}

async function upsertProfileSports(
  profileId: string,
  sports: NonNullable<CreateUserProfileInput["sports"]> | NonNullable<UpdateUserProfileInput["sports"]>
) {
  if (sports.length === 0) {
    return;
  }

  const payload = sports.map((sport) => ({
    profile_id: profileId,
    sport_id: sport.sportId,
    skill_level: sport.skillLevel,
    is_active: "isActive" in sport ? sport.isActive ?? true : true
  }));

  const { error } = await supabase
    .from("profile_sports")
    .upsert(payload, { onConflict: "profile_id,sport_id" });

  if (error) {
    throw error;
  }
}

export async function createUserProfile(input: CreateUserProfileInput): Promise<Profile> {
  const existingProfile = await getUserProfile({ firebaseUid: input.firebaseUid });

  if (existingProfile) {
    if (input.sports?.length) {
      await upsertProfileSports(existingProfile.id, input.sports);
    }

    return existingProfile;
  }

  const insertPayload: ProfileInsert = {
    firebase_uid: input.firebaseUid,
    email: input.email,
    display_name: input.displayName,
    username: input.displayName,
    vancouver_area: input.vancouverArea,
    challenge_radius_km: input.challengeRadiusKm,
    availability_status: input.availabilityStatus ?? "unavailable",
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    onboarding_completed: input.onboardingCompleted ?? false
  };

  let { data: profileRow, error } = await supabase
    .from("profiles")
    .upsert(insertPayload, { onConflict: "firebase_uid" })
    .select("id")
    .single();

  if (error && isMissingAvailabilityColumnError(error)) {
    debugLog("[userService] create profile fallback without availability_status", {
      firebaseUid: input.firebaseUid
    });
    const { availability_status: _ignoredAvailabilityStatus, ...legacyInsertPayload } = insertPayload;

    ({ data: profileRow, error } = await supabase
      .from("profiles")
      .upsert(legacyInsertPayload, { onConflict: "firebase_uid" })
      .select("id")
      .single());
  }

  if (error) {
    throw error;
  }

  if (!profileRow) {
    throw new Error("Profile not found after creation.");
  }

  if (input.sports?.length) {
    await upsertProfileSports(profileRow.id, input.sports);
  }

  const profile = await getUserProfile({ profileId: profileRow.id });

  if (!profile) {
    throw new Error("Profile not found after creation.");
  }

  return profile;
}

export async function getUserProfile({
  profileId,
  firebaseUid
}: {
  profileId?: string;
  firebaseUid?: string;
}): Promise<Profile | null> {
  if (!profileId && !firebaseUid) {
    throw new Error("getUserProfile requires profileId or firebaseUid");
  }

  function applyProfileFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(query: TQuery) {
    if (profileId) {
      return query.eq("id", profileId);
    }

    return query.eq("firebase_uid", firebaseUid as string);
  }

  let { data, error } = await applyProfileFilter(
    supabase.from("profiles").select(getProfileSelect(true, true))
  ).maybeSingle<ProfileWithRelations>();

  if (error && (isMissingAvailabilityColumnError(error) || isMissingPlayStyleTagsColumnError(error))) {
    debugLog("[userService] profile select fallback without optional profile fields", {
      profileId: profileId ?? null,
      firebaseUid: firebaseUid ?? null
    });
    ({ data, error } = await applyProfileFilter(
      supabase.from("profiles").select(
        getProfileSelect(!isMissingAvailabilityColumnError(error), !isMissingPlayStyleTagsColumnError(error))
      )
    ).maybeSingle<ProfileWithRelations>());
  }

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProfile(data);
}

export async function getPlayerById(profileId: string): Promise<PlayerSummary | null> {
  let { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, play_style_tags, profile_stats(profile_id, wins, losses)")
    .eq("id", profileId)
    .maybeSingle();

  if (error && isMissingPlayStyleTagsColumnError(error)) {
    ({ data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, profile_stats(profile_id, wins, losses)")
      .eq("id", profileId)
      .maybeSingle());
  }

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapPlayerSummary(data);
}

export async function updateUserProfile(
  profileId: string,
  input: UpdateUserProfileInput
): Promise<Profile> {
  const updatePayload: ProfileUpdate = {
    display_name: input.displayName,
    username: input.displayName,
    vancouver_area: input.vancouverArea,
    challenge_radius_km: input.challengeRadiusKm,
    availability_status: input.availabilityStatus,
    latitude: input.latitude,
    longitude: input.longitude,
    play_style_tags: input.playStyleTags,
    onboarding_completed: input.onboardingCompleted
  };

  let { error } = await supabase.from("profiles").update(updatePayload).eq("id", profileId);

  if (error && (isMissingAvailabilityColumnError(error) || isMissingPlayStyleTagsColumnError(error))) {
    debugLog("[userService] update profile fallback without optional profile fields", {
      profileId
    });
    const {
      availability_status: _ignoredAvailabilityStatus,
      play_style_tags: _ignoredPlayStyleTags,
      ...legacyUpdatePayload
    } = updatePayload;

    if (Object.values(legacyUpdatePayload).some((value) => value !== undefined)) {
      ({ error } = await supabase.from("profiles").update(legacyUpdatePayload).eq("id", profileId));
    } else {
      error = null;
    }
  }

  if (error) {
    throw error;
  }

  if (input.sports) {
    await upsertProfileSports(profileId, input.sports);
  }

  const profile = await getUserProfile({ profileId });

  if (!profile) {
    throw new Error("Profile not found after update.");
  }

  return profile;
}

export async function searchProfilesByUsername(
  currentProfileId: string,
  query: string
): Promise<FriendSearchResult[]> {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  let { data, error } = await supabase
    .from("profiles")
    .select(getFriendSearchSelect(true))
    .eq("onboarding_completed", true)
    .neq("id", currentProfileId)
    .ilike("username", `%${normalizedQuery}%`)
    .order("username", { ascending: true })
    .limit(20);

  if (error && (isMissingAvailabilityColumnError(error) || isMissingPlayStyleTagsColumnError(error))) {
    debugLog("[userService] friend search fallback without optional profile fields", {
      currentProfileId
    });
    ({ data, error } = await supabase
      .from("profiles")
      .select(getFriendSearchSelect(!isMissingAvailabilityColumnError(error), !isMissingPlayStyleTagsColumnError(error)))
      .eq("onboarding_completed", true)
      .neq("id", currentProfileId)
      .ilike("username", `%${normalizedQuery}%`)
      .order("username", { ascending: true })
      .limit(20));
  }

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as unknown) as FriendSearchRow[];

  return rows.map((row) => {
    const activeSport = Array.isArray(row.profile_sports)
      ? row.profile_sports.find((item) => item.is_active && item.sports?.slug)
      : null;
    const stats = Array.isArray(row.profile_stats) ? row.profile_stats[0] : row.profile_stats;

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      vancouverArea: row.vancouver_area,
      availabilityStatus: withOptionalFieldFallback(row.availability_status as AvailabilityStatus | null, "unavailable"),
      playStyleTags: normalizePlayStyleTags(row.play_style_tags),
      matchesPlayed: stats?.matches_played ?? 0,
      primarySport: activeSport?.sports?.slug ?? undefined,
      primarySkillLevel: activeSport?.skill_level
    };
  });
}

export async function getProfileStats(profileId: string): Promise<Pick<Profile, "wins" | "losses" | "matchesPlayed">> {
  const { data, error } = await supabase
    .from("profile_stats")
    .select("wins, losses, matches_played")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    wins: data?.wins ?? 0,
    losses: data?.losses ?? 0,
    matchesPlayed: data?.matches_played ?? 0
  };
}

type RecentMatchRow = Database["public"]["Tables"]["matches"]["Row"] & {
  sports: SportRow | null;
  challenges: Pick<
    Database["public"]["Tables"]["challenges"]["Row"],
    "stake_type" | "stake_label" | "stake_note"
  > | null;
};

export async function getRecentMatches(profileId: string): Promise<RecentMatch[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*, sports(*), challenges(stake_type, stake_label, stake_note)")
    .eq("result_status", "confirmed")
    .or(`challenger_profile_id.eq.${profileId},opponent_profile_id.eq.${profileId}`)
    .order("confirmed_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RecentMatchRow[];
  if (rows.length === 0) {
    return [];
  }

  const opponentIds = Array.from(
    new Set(
      rows.map((row) =>
        row.challenger_profile_id === profileId ? row.opponent_profile_id : row.challenger_profile_id
      )
    )
  );

  const { data: opponents, error: opponentsError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", opponentIds);

  if (opponentsError) {
    throw opponentsError;
  }

  const opponentNameById = new Map(
    (opponents ?? []).map((opponent) => [opponent.id, opponent.display_name])
  );

  return rows.map((row) => {
    const opponentId =
      row.challenger_profile_id === profileId ? row.opponent_profile_id : row.challenger_profile_id;

    return {
      id: row.id,
      sport: row.sports?.slug ?? DEFAULT_LAUNCH_SPORT,
      opponentProfileId: opponentId,
      opponentName: opponentNameById.get(opponentId) ?? "Opponent",
      scoreSummary: row.score_summary ?? "Confirmed result",
      result: row.winner_profile_id === profileId ? "win" : "loss",
      date: row.confirmed_at ?? row.updated_at,
      stakeType: row.challenges?.stake_type ?? undefined,
      stakeLabel: row.challenges?.stake_label ?? undefined,
      stakeNote: row.challenges?.stake_note ?? undefined
    };
  });
}
