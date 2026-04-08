import { Challenge, OpenChallenge } from "@/core/types/models";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Database, Json } from "@/types/database";
import { DEFAULT_LAUNCH_SPORT, getSportConfigById } from "@/config/sports";
import { debugError, debugLog } from "@/shared/lib/logger";
import { toServiceError } from "@/shared/lib/serviceError";

import { createActivityEvent } from "./activityService";
import { supabase } from "./supabaseClient";

type ChallengeRow = Database["public"]["Tables"]["challenges"]["Row"];
type ChallengeInsert = Database["public"]["Tables"]["challenges"]["Insert"];
type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];
type SportRow = Database["public"]["Tables"]["sports"]["Row"];

export type CreateChallengeInput = {
  sportId: number;
  challengerProfileId: string;
  opponentProfileId?: string;
  scheduledAt: string;
  locationName: string;
  challengeType: Database["public"]["Enums"]["challenge_type"];
  stakeType?: string | null;
  stakeLabel?: string | null;
  stakeNote?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  isOpen?: boolean;
};

const DEFAULT_STAKE_TYPE = "bragging_rights";
const DEFAULT_STAKE_LABEL = "Bragging Rights";

export type ChallengeInboxItem = Challenge & {
  counterpartProfileId: string;
  counterpartName: string;
  direction: "received" | "sent";
};

type ChallengeRowWithSport = ChallengeRow & {
  sports: SportRow | null;
};

type OpenChallengeRow = {
  id: string;
  challenger_profile_id: string;
  scheduled_at: string;
  location_name: string;
  challenge_type: Database["public"]["Enums"]["challenge_type"];
  stake_type: string;
  stake_label: string;
  stake_note: string | null;
  created_at: string;
  sport_id: number;
  sports: SportRow | null;
  challenger: {
    id: string;
    username: string | null;
    display_name: string;
    vancouver_area: string;
  } | null;
};

function getRealtimeChallengeRow(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
): Partial<ChallengeRow> | null {
  if (payload.eventType === "DELETE") {
    return (payload.old as Partial<ChallengeRow>) ?? null;
  }

  return (payload.new as Partial<ChallengeRow>) ?? null;
}

function isRelevantChallengeRealtimeEvent(
  profileId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
) {
  const row = getRealtimeChallengeRow(payload);

  if (!row) {
    return false;
  }

  return row.opponent_profile_id === profileId || row.challenger_profile_id === profileId;
}

async function getParticipantNames(challengerProfileId: string, opponentProfileId?: string | null) {
  const participantIds = [challengerProfileId, opponentProfileId].filter(Boolean) as string[];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", participantIds);

  if (error) {
    throw error;
  }

  const namesById = new Map((data ?? []).map((profile) => [profile.id, profile.display_name]));

  return {
    challengerName: namesById.get(challengerProfileId) ?? "Player",
    opponentName: (opponentProfileId ? namesById.get(opponentProfileId) : undefined) ?? "Player"
  };
}

function mapChallenge(row: ChallengeRowWithSport): Challenge {
  return {
    id: row.id,
    sport: row.sports?.slug ?? getSportConfigById(row.sport_id)?.slug ?? DEFAULT_LAUNCH_SPORT,
    challengerProfileId: row.challenger_profile_id,
    opponentProfileId: row.opponent_profile_id ?? undefined,
    scheduledAt: row.scheduled_at,
    locationName: row.location_name,
    challengeType: row.challenge_type,
    stakeType: row.stake_type ?? DEFAULT_STAKE_TYPE,
    stakeLabel: row.stake_label ?? DEFAULT_STAKE_LABEL,
    stakeNote: row.stake_note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    isOpen: row.is_open
  };
}

function mapOpenChallenge(row: OpenChallengeRow): OpenChallenge {
  return {
    id: row.id,
    challengerProfileId: row.challenger_profile_id,
    challengerUsername: row.challenger?.username ?? row.challenger?.display_name ?? "player",
    challengerDisplayName: row.challenger?.display_name ?? row.challenger?.username ?? "Player",
    challengerArea: row.challenger?.vancouver_area ?? "",
    sportId: row.sport_id,
    sport: row.sports?.slug ?? getSportConfigById(row.sport_id)?.slug ?? DEFAULT_LAUNCH_SPORT,
    sportName: row.sports?.name ?? getSportConfigById(row.sport_id)?.displayName ?? "Sport",
    scheduledAt: row.scheduled_at,
    locationName: row.location_name,
    challengeType: row.challenge_type,
    stakeType: row.stake_type ?? DEFAULT_STAKE_TYPE,
    stakeLabel: row.stake_label ?? DEFAULT_STAKE_LABEL,
    stakeNote: row.stake_note ?? undefined,
    createdAt: row.created_at
  };
}

async function getChallengeById(challengeId: string): Promise<Challenge> {
  const { data, error } = await supabase
    .from("challenges")
    .select("*, sports(*)")
    .eq("id", challengeId)
    .single();

  if (error) {
    throw error;
  }

  return mapChallenge(data as ChallengeRowWithSport);
}

async function getChallengesByColumn(
  column: "opponent_profile_id" | "challenger_profile_id",
  profileId: string
): Promise<Challenge[]> {
  debugLog("[challengeService] loading challenges", {
    column,
    profileId
  });

  const { data, error } = await supabase
    .from("challenges")
    .select("*, sports(*)")
    .eq(column, profileId)
    .order("created_at", { ascending: false });

  if (error) {
    debugError("[challengeService] failed to load challenges", error, {
      column,
      profileId
    });
    throw error;
  }

  return ((data ?? []) as ChallengeRowWithSport[]).map(mapChallenge);
}

async function attachCounterpartNames(
  challenges: Challenge[],
  currentProfileId: string,
  direction: "received" | "sent"
): Promise<ChallengeInboxItem[]> {
  const openSentChallenges = direction === "sent"
    ? challenges.filter(
        (challenge) =>
          challenge.isOpen &&
          challenge.challengerProfileId === currentProfileId &&
          !challenge.opponentProfileId &&
          challenge.status === "pending"
      )
    : [];

  const filteredChallenges = challenges.filter((challenge) => {
    if (challenge.isOpen && !challenge.opponentProfileId) {
      return false;
    }

    const isTrueSelfChallenge = challenge.challengerProfileId === challenge.opponentProfileId;
    const isValidDirection =
      direction === "received"
        ? challenge.opponentProfileId === currentProfileId &&
          challenge.challengerProfileId !== currentProfileId
        : challenge.challengerProfileId === currentProfileId &&
          challenge.opponentProfileId !== currentProfileId;
    const counterpartProfileId =
      direction === "received" ? challenge.challengerProfileId : challenge.opponentProfileId;
    const hasMissingCounterpart = !counterpartProfileId;
    const hasInvalidCounterpart = counterpartProfileId === currentProfileId;

    if (isTrueSelfChallenge || !isValidDirection || hasMissingCounterpart || hasInvalidCounterpart) {
      return false;
    }

    return true;
  });

  const counterpartIds = Array.from(
    new Set(
      filteredChallenges.map((challenge) =>
        direction === "received" ? challenge.challengerProfileId : challenge.opponentProfileId
      ).filter((profileId): profileId is string => Boolean(profileId))
    )
  );

  if (filteredChallenges.length === 0 || counterpartIds.length === 0) {
    return openSentChallenges.map((challenge) => ({
      ...challenge,
      counterpartProfileId: challenge.id,
      counterpartName: "Open challenge",
      direction
    }));
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", counterpartIds);

  if (error) {
    throw error;
  }

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const namedChallenges = filteredChallenges.map((challenge) => {
    const counterpartProfileId =
      (direction === "received" ? challenge.challengerProfileId : challenge.opponentProfileId) ?? challenge.id;
    const counterpartProfile = profilesById.get(counterpartProfileId);
    const counterpartName =
      counterpartProfile?.username ?? counterpartProfile?.display_name ?? "Unknown player";

    return {
      ...challenge,
      counterpartProfileId,
      counterpartName,
      direction
    };
  });

  return [
    ...openSentChallenges.map((challenge) => ({
      ...challenge,
      counterpartProfileId: challenge.id,
      counterpartName: "Open challenge",
      direction
    })),
    ...namedChallenges
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

async function updateChallengeStatus(
  challengeId: string,
  status: Extract<ChallengeStatus, "accepted" | "declined">
): Promise<Challenge> {
  const timestampColumn = status === "accepted" ? "accepted_at" : "declined_at";
  debugLog("[challengeService] updating challenge status", {
    challengeId,
    status,
    timestampColumn
  });

  try {
    const { data, error } = await supabase
      .from("challenges")
      .update({
        status,
        [timestampColumn]: new Date().toISOString()
      })
      .eq("id", challengeId)
      .eq("status", "pending")
      .select("*, sports(*)");

    debugLog("[challengeService] challenge status update result", {
      challengeId,
      status,
      rowCount: data?.length ?? 0
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      const { data: existingChallenge, error: existingChallengeError } = await supabase
        .from("challenges")
        .select("id, status")
        .eq("id", challengeId)
        .maybeSingle();

      if (existingChallengeError) {
        throw existingChallengeError;
      }

      if (!existingChallenge) {
        throw new Error("Challenge not found.");
      }

      if (existingChallenge.status === status) {
        throw new Error(
          status === "accepted" ? "This challenge was already accepted." : "This challenge was already declined."
        );
      }

      throw new Error(`This challenge can no longer be ${status}. Current status: ${existingChallenge.status}.`);
    }

    if (data.length > 1) {
      throw new Error(`Expected one challenge row for id ${challengeId}, received ${data.length}.`);
    }

    const challengeRow = data[0] as ChallengeRowWithSport;

    if (status === "accepted") {
      try {
        if (!challengeRow.opponent_profile_id) {
          throw new Error("Accepted challenge is missing an opponent.");
        }

        const { challengerName, opponentName } = await getParticipantNames(
          challengeRow.challenger_profile_id,
          challengeRow.opponent_profile_id
        );

        const metadata: Json = {
          actor_display_name: opponentName,
          opponent_display_name: challengerName,
          target_display_name: challengerName,
          sport_name: challengeRow.sports?.name,
          location: challengeRow.location_name,
          challenge_location: challengeRow.location_name
        };

        await createActivityEvent({
          actorProfileId: challengeRow.opponent_profile_id,
          targetProfileId: challengeRow.challenger_profile_id,
          challengeId: challengeRow.id,
          sportId: challengeRow.sports?.id ?? null,
          eventType: "challenge_accepted",
          metadata
        });
      } catch (activityError) {
        debugError("Failed to log challenge accepted activity", activityError, {
          challengeId: challengeRow.id
        });
      }
    }

    return mapChallenge(challengeRow);
  } catch (error) {
    debugError("[challengeService] challenge status update failed", error, {
      challengeId,
      status
    });
    throw toServiceError(
      error,
      status === "accepted" ? "Unable to accept challenge right now." : "Unable to decline challenge right now."
    );
  }
}

export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  debugLog("[challengeService] creating challenge", {
    challengerProfileId: input.challengerProfileId,
    opponentProfileId: input.opponentProfileId ?? null,
    sportId: input.sportId,
    challengeType: input.challengeType,
    isOpen: input.isOpen ?? false
  });

  try {
    if (!input.isOpen && !input.opponentProfileId) {
      throw new Error("Select an opponent first.");
    }

    const payload: ChallengeInsert = {
      sport_id: input.sportId,
      challenger_profile_id: input.challengerProfileId,
      opponent_profile_id: input.isOpen ? null : input.opponentProfileId,
      scheduled_at: input.scheduledAt,
      location_name: input.locationName,
      location_latitude: input.locationLatitude ?? null,
      location_longitude: input.locationLongitude ?? null,
      challenge_type: input.challengeType,
      stake_type: input.stakeType ?? DEFAULT_STAKE_TYPE,
      stake_label: input.stakeLabel ?? DEFAULT_STAKE_LABEL,
      stake_note: input.stakeNote ?? null,
      is_open: input.isOpen ?? false
    };

    const { data, error } = await supabase
      .from("challenges")
      .insert(payload)
      .select("*, sports(*)")
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Challenge was created but no row was returned.");
    }

    const challengeRow = data as ChallengeRowWithSport;

    if (!input.isOpen && challengeRow.opponent_profile_id) {
      try {
        const { challengerName, opponentName } = await getParticipantNames(
          challengeRow.challenger_profile_id,
          challengeRow.opponent_profile_id
        );

        const metadata: Json = {
          actor_display_name: challengerName,
          opponent_display_name: opponentName,
          target_display_name: opponentName,
          sport_name: challengeRow.sports?.name,
          location: challengeRow.location_name,
          challenge_location: challengeRow.location_name
        };

        await createActivityEvent({
          actorProfileId: challengeRow.challenger_profile_id,
          targetProfileId: challengeRow.opponent_profile_id,
          challengeId: challengeRow.id,
          sportId: challengeRow.sports?.id ?? input.sportId,
          eventType: "challenge_created",
          metadata
        });
      } catch (activityError) {
        debugError("Failed to log challenge created activity", activityError, {
          challengeId: challengeRow.id
        });
      }
    }

    return mapChallenge(challengeRow);
  } catch (error) {
    debugError("[challengeService] failed to create challenge", error, {
      challengerProfileId: input.challengerProfileId,
      opponentProfileId: input.opponentProfileId ?? null,
      sportId: input.sportId
    });
    throw toServiceError(error, "Unable to create challenge right now.");
  }
}

export async function getReceivedChallenges(profileId: string): Promise<Challenge[]> {
  return getChallengesByColumn("opponent_profile_id", profileId);
}

export async function getSentChallenges(profileId: string): Promise<Challenge[]> {
  return getChallengesByColumn("challenger_profile_id", profileId);
}

export async function getReceivedChallengeInbox(profileId: string): Promise<ChallengeInboxItem[]> {
  const challenges = await getReceivedChallenges(profileId);
  return attachCounterpartNames(
    challenges.filter((challenge) => challenge.status !== "declined" && challenge.status !== "canceled"),
    profileId,
    "received"
  );
}

export async function getSentChallengeInbox(profileId: string): Promise<ChallengeInboxItem[]> {
  const challenges = await getSentChallenges(profileId);
  return attachCounterpartNames(
    challenges.filter((challenge) => challenge.status !== "declined" && challenge.status !== "canceled"),
    profileId,
    "sent"
  );
}

export async function getPendingIncomingChallengeCount(profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("opponent_profile_id", profileId)
    .eq("status", "pending");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export type ChallengeInboxActivitySummary = {
  incomingPendingCount: number;
  acceptedOutgoingCount: number;
  totalCount: number;
};

export async function getChallengeInboxActivitySummary(
  profileId: string,
  lastViewedAt?: string | null
): Promise<ChallengeInboxActivitySummary> {
  let incomingQuery = supabase
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("opponent_profile_id", profileId)
    .eq("status", "pending");

  let acceptedOutgoingQuery = supabase
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("challenger_profile_id", profileId)
    .eq("status", "accepted");

  if (lastViewedAt) {
    incomingQuery = incomingQuery.gt("created_at", lastViewedAt);
    acceptedOutgoingQuery = acceptedOutgoingQuery.gt("accepted_at", lastViewedAt);
  }

  const [{ count: incomingPendingCount, error: incomingError }, { count: acceptedOutgoingCount, error: outgoingError }] =
    await Promise.all([incomingQuery, acceptedOutgoingQuery]);

  if (incomingError) {
    throw incomingError;
  }

  if (outgoingError) {
    throw outgoingError;
  }

  return {
    incomingPendingCount: incomingPendingCount ?? 0,
    acceptedOutgoingCount: acceptedOutgoingCount ?? 0,
    totalCount: (incomingPendingCount ?? 0) + (acceptedOutgoingCount ?? 0)
  };
}

export function subscribeToChallengeActivity(
  profileId: string,
  onRelevantChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`challenge-activity-${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "challenges"
      },
      (payload) => {
        if (!isRelevantChallengeRealtimeEvent(profileId, payload)) {
          return;
        }

        debugLog("[challengeService] realtime challenge activity received", {
          profileId,
          eventType: payload.eventType
        });
        onRelevantChange();
      }
    )
    .subscribe();
}

export async function getChallengesForProfile(profileId: string): Promise<Challenge[]> {
  const [received, sent] = await Promise.all([
    getReceivedChallenges(profileId),
    getSentChallenges(profileId)
  ]);

  return [...received, ...sent].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export async function getOpenChallenges(
  currentProfileId: string,
  sportId?: number,
  currentArea?: string
): Promise<OpenChallenge[]> {
  try {
    let query = supabase
      .from("challenges")
      .select(`
        id,
        challenger_profile_id,
        scheduled_at,
        location_name,
        challenge_type,
        stake_type,
        stake_label,
        stake_note,
        created_at,
        sport_id,
        sports(*),
        challenger:profiles!challenges_challenger_profile_id_fkey (
          id,
          username,
          display_name,
          vancouver_area
        )
      `)
      .eq("is_open", true)
      .eq("status", "pending")
      .is("opponent_profile_id", null)
      .neq("challenger_profile_id", currentProfileId)
      .gt("scheduled_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (sportId) {
      query = query.eq("sport_id", sportId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const challenges = ((data ?? []) as OpenChallengeRow[]).map(mapOpenChallenge);

    if (!currentArea) {
      return challenges;
    }

    return challenges.sort((left, right) => {
      const leftPriority = left.challengerArea === currentArea ? 0 : 1;
      const rightPriority = right.challengerArea === currentArea ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  } catch (error) {
    debugError("[challengeService] failed to load open challenges", error, {
      currentProfileId,
      sportId: sportId ?? null
    });
    throw toServiceError(error, "Unable to load open challenges right now.");
  }
}

export async function acceptOpenChallenge(challengeId: string, accepterProfileId: string): Promise<Challenge> {
  try {
    const { data, error } = await supabase
      .from("challenges")
      .update({
        opponent_profile_id: accepterProfileId,
        status: "accepted",
        accepted_at: new Date().toISOString()
      })
      .eq("id", challengeId)
      .eq("is_open", true)
      .eq("status", "pending")
      .is("opponent_profile_id", null)
      .neq("challenger_profile_id", accepterProfileId)
      .select("*, sports(*)");

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      const { data: existingChallenge, error: existingChallengeError } = await supabase
        .from("challenges")
        .select("id, challenger_profile_id, is_open, status, opponent_profile_id")
        .eq("id", challengeId)
        .maybeSingle();

      if (existingChallengeError) {
        throw existingChallengeError;
      }

      if (!existingChallenge) {
        throw new Error("Challenge not found.");
      }

      if (existingChallenge.challenger_profile_id === accepterProfileId) {
        throw new Error("You cannot accept your own open challenge.");
      }

      if (!existingChallenge.is_open) {
        throw new Error("This challenge is not open.");
      }

      if (existingChallenge.status !== "pending" || existingChallenge.opponent_profile_id) {
        throw new Error("This open challenge is no longer available.");
      }

      throw new Error("Unable to join this challenge right now.");
    }

    if (data.length > 1) {
      throw new Error(`Expected one open challenge row for id ${challengeId}, received ${data.length}.`);
    }

    const challengeRow = data[0] as ChallengeRowWithSport;

    try {
      if (!challengeRow.opponent_profile_id) {
        throw new Error("Accepted open challenge is missing an opponent.");
      }

      const { challengerName, opponentName } = await getParticipantNames(
        challengeRow.challenger_profile_id,
        challengeRow.opponent_profile_id
      );

      const metadata: Json = {
        actor_display_name: opponentName,
        opponent_display_name: challengerName,
        target_display_name: challengerName,
        sport_name: challengeRow.sports?.name,
        location: challengeRow.location_name,
        challenge_location: challengeRow.location_name
      };

      await createActivityEvent({
        actorProfileId: challengeRow.opponent_profile_id,
        targetProfileId: challengeRow.challenger_profile_id,
        challengeId: challengeRow.id,
        sportId: challengeRow.sports?.id ?? null,
        eventType: "challenge_accepted",
        metadata
      });
    } catch (activityError) {
      debugError("Failed to log open challenge accepted activity", activityError, {
        challengeId: challengeRow.id
      });
    }

    return mapChallenge(challengeRow);
  } catch (error) {
    debugError("[challengeService] failed to accept open challenge", error, {
      challengeId,
      accepterProfileId
    });
    throw toServiceError(error, "Unable to join this challenge right now.");
  }
}

export async function acceptChallenge(challengeId: string): Promise<Challenge> {
  return updateChallengeStatus(challengeId, "accepted");
}

export async function declineChallenge(challengeId: string): Promise<Challenge> {
  return updateChallengeStatus(challengeId, "declined");
}

export async function cancelChallenge(challengeId: string, challengerProfileId: string): Promise<Challenge> {
  try {
    const { data, error } = await supabase
      .from("challenges")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString()
      })
      .eq("id", challengeId)
      .eq("challenger_profile_id", challengerProfileId)
      .eq("status", "pending")
      .select("*, sports(*)");

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      const { data: existingChallenge, error: existingChallengeError } = await supabase
        .from("challenges")
        .select("id, challenger_profile_id, status")
        .eq("id", challengeId)
        .maybeSingle();

      if (existingChallengeError) {
        throw existingChallengeError;
      }

      if (!existingChallenge) {
        throw new Error("Challenge not found.");
      }

      if (existingChallenge.challenger_profile_id !== challengerProfileId) {
        throw new Error("Only the challenger can cancel this challenge.");
      }

      if (existingChallenge.status !== "pending") {
        throw new Error(`This challenge can no longer be canceled. Current status: ${existingChallenge.status}.`);
      }

      throw new Error("Unable to cancel challenge right now.");
    }

    if (data.length > 1) {
      throw new Error(`Expected one challenge row for id ${challengeId}, received ${data.length}.`);
    }

    return mapChallenge(data[0] as ChallengeRowWithSport);
  } catch (error) {
    debugError("[challengeService] failed to cancel challenge", error, {
      challengeId,
      challengerProfileId
    });
    throw toServiceError(error, "Unable to cancel challenge right now.");
  }
}
