import { Challenge, OpenChallenge } from "@/core/types/models";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Database, Json } from "@/types/database";
import { DEFAULT_LAUNCH_SPORT, getSportConfigById } from "@/config/sports";
import { debugError, debugLog } from "@/shared/lib/logger";
import { toServiceError } from "@/shared/lib/serviceError";

import { createActivityEvent } from "./activityService";
import { getAuthenticatedRequestHeaders } from "./authSession";
import { supabase } from "./supabaseClient";

type ChallengeRow = Database["public"]["Tables"]["challenges"]["Row"];
type ChallengeUpdate = Database["public"]["Tables"]["challenges"]["Update"];
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

type LoopTwoChallengeResponse = {
  id: string;
  direction: "incoming" | "outgoing";
  opponent: { username: string; displayName: string };
  sport: Challenge["sport"];
  challengeType: Challenge["challengeType"];
  status: Challenge["status"];
  createdAt: string;
  scheduledAt: string;
  locationName: string;
  stakeType: string;
  stakeLabel: string;
  stakeNote?: string | null;
};

export type LoopTwoChallenge = LoopTwoChallengeResponse;

type ChallengeIdentity = {
  profileId: string;
  displayName: string;
  username: string;
};

type CanonicalUserChallenge = LoopTwoChallengeResponse & {
  challengerProfileId: string;
  opponentProfileId: string | null;
  participants: {
    challenger: ChallengeIdentity;
    opponent: ChallengeIdentity | null;
  };
  counterpart: ChallengeIdentity | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  canceledAt: string | null;
  completedAt: string | null;
  isOpen: boolean;
};

type GetUserChallengesResponse = {
  challenges: CanonicalUserChallenge[];
  openChallenges?: CanonicalUserChallenge[];
};

export type CreateDirectChallengeInput = {
  opponentProfileId: string;
  sport: Challenge["sport"];
  scheduledAt: string;
  locationName: string;
  challengeType: Challenge["challengeType"];
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
};

export type CreateLoopTwoOpenChallengeInput = {
  sport: Challenge["sport"];
  scheduledAt: string;
  locationName: string;
  challengeType: Challenge["challengeType"];
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
};

type LoopTwoOpenChallengesResponse = {
  challenges: OpenChallenge[];
  ownChallenges: OpenChallenge[];
};

export type LoopTwoChallengeAction = "accept" | "decline" | "cancel";

export type RespondToLoopTwoChallengeResult = {
  challenge: LoopTwoChallenge;
  match?: {
    id: string;
    resultStatus: "pending_submission";
  };
};

async function invokeLoopTwoChallengeFunction<T>(functionName: string, body: Record<string, unknown> = {}): Promise<T> {
  const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseProjectUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured.");
  }

  const authHeaders = await getAuthenticatedRequestHeaders();
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Unable to complete challenge request (${response.status}).`);
  }

  if (!payload) {
    throw new Error("Challenge service returned an empty response.");
  }

  return payload;
}

export async function createDirectChallenge(input: CreateDirectChallengeInput): Promise<LoopTwoChallenge> {
  const response = await invokeLoopTwoChallengeFunction<{ challenge: LoopTwoChallenge }>("create-direct-challenge", input);
  return response.challenge;
}

export async function createLoopTwoOpenChallenge(input: CreateLoopTwoOpenChallengeInput): Promise<OpenChallenge> {
  const response = await invokeLoopTwoChallengeFunction<{ challenge: OpenChallenge }>("create-open-challenge", input);
  return response.challenge;
}

export async function getLoopTwoOpenChallenges(sport: Challenge["sport"]): Promise<LoopTwoOpenChallengesResponse> {
  return invokeLoopTwoChallengeFunction<LoopTwoOpenChallengesResponse>("get-open-challenges", { sport });
}

export async function acceptLoopTwoOpenChallenge(challengeId: string): Promise<{ matchId: string }> {
  return invokeLoopTwoChallengeFunction<{ matchId: string }>("accept-open-challenge", { challengeId });
}

export async function cancelLoopTwoOpenChallenge(challengeId: string): Promise<void> {
  await invokeLoopTwoChallengeFunction("cancel-open-challenge", { challengeId });
}

export async function getLoopTwoChallenges(): Promise<LoopTwoChallenge[]> {
  const response = await invokeLoopTwoChallengeFunction<GetUserChallengesResponse>("get-user-challenges");
  return response.challenges;
}

export async function respondToLoopTwoChallenge(
  challengeId: string,
  action: LoopTwoChallengeAction
): Promise<RespondToLoopTwoChallengeResult> {
  return invokeLoopTwoChallengeFunction<RespondToLoopTwoChallengeResult>("respond-to-challenge", {
    challengeId,
    action
  });
}

export type ChallengeInboxItem = Challenge & {
  counterpartProfileId: string;
  counterpartName: string;
  counterpartUsername?: string;
  direction: "received" | "sent";
};

export type ChallengeInbox = {
  received: ChallengeInboxItem[];
  sent: ChallengeInboxItem[];
};

type ChallengeRowWithSport = ChallengeRow & {
  sports: SportRow | null;
};

type CreateChallengeResponse = {
  error?: string;
  challenge?: ChallengeRowWithSport;
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

function getCanonicalChallengeName(identity: ChallengeIdentity | null) {
  return identity?.displayName.trim() || identity?.username.trim() || "Opponent";
}

function mapCanonicalChallengeInboxItem(
  challenge: CanonicalUserChallenge,
  currentProfileId: string
): ChallengeInboxItem | null {
  const direction = challenge.direction === "incoming" ? "received" : "sent";

  if (challenge.isOpen && !challenge.opponentProfileId) {
    if (
      direction !== "sent" ||
      challenge.challengerProfileId !== currentProfileId ||
      challenge.status !== "pending"
    ) {
      return null;
    }

    return {
      id: challenge.id,
      sport: challenge.sport,
      challengerProfileId: challenge.challengerProfileId,
      scheduledAt: challenge.scheduledAt,
      locationName: challenge.locationName,
      challengeType: challenge.challengeType,
      stakeType: challenge.stakeType ?? DEFAULT_STAKE_TYPE,
      stakeLabel: challenge.stakeLabel ?? DEFAULT_STAKE_LABEL,
      stakeNote: challenge.stakeNote ?? undefined,
      status: challenge.status,
      createdAt: challenge.createdAt,
      isOpen: true,
      counterpartProfileId: challenge.id,
      counterpartName: "Open challenge",
      direction
    };
  }

  const counterpart = challenge.counterpart;
  const isValidDirection =
    direction === "received"
      ? challenge.opponentProfileId === currentProfileId &&
        challenge.challengerProfileId !== currentProfileId
      : challenge.challengerProfileId === currentProfileId &&
        challenge.opponentProfileId !== currentProfileId;

  if (
    !isValidDirection ||
    !challenge.opponentProfileId ||
    !counterpart?.profileId ||
    counterpart.profileId === currentProfileId
  ) {
    return null;
  }

  return {
    id: challenge.id,
    sport: challenge.sport,
    challengerProfileId: challenge.challengerProfileId,
    opponentProfileId: challenge.opponentProfileId,
    scheduledAt: challenge.scheduledAt,
    locationName: challenge.locationName,
    challengeType: challenge.challengeType,
    stakeType: challenge.stakeType ?? DEFAULT_STAKE_TYPE,
    stakeLabel: challenge.stakeLabel ?? DEFAULT_STAKE_LABEL,
    stakeNote: challenge.stakeNote ?? undefined,
    status: challenge.status,
    createdAt: challenge.createdAt,
    isOpen: challenge.isOpen,
    counterpartProfileId: counterpart.profileId,
    counterpartName: getCanonicalChallengeName(counterpart),
    counterpartUsername: counterpart.username.trim() || undefined,
    direction
  };
}

export async function getChallengeInbox(currentProfileId: string): Promise<ChallengeInbox> {
  const response = await invokeLoopTwoChallengeFunction<GetUserChallengesResponse>("get-user-challenges");
  const canonicalChallenges = [
    ...response.challenges,
    ...(response.openChallenges ?? [])
  ];
  const items = canonicalChallenges
    .filter((challenge) => challenge.status !== "declined" && challenge.status !== "canceled")
    .map((challenge) => mapCanonicalChallengeInboxItem(challenge, currentProfileId))
    .filter((challenge): challenge is ChallengeInboxItem => Boolean(challenge))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return {
    received: items.filter((challenge) => challenge.direction === "received"),
    sent: items.filter((challenge) => challenge.direction === "sent")
  };
}

async function updateChallengeStatus(
  challengeId: string,
  status: Extract<ChallengeStatus, "accepted" | "declined">
): Promise<Challenge> {
  const updatePayload: ChallengeUpdate = status === "accepted"
    ? {
        status,
        accepted_at: new Date().toISOString()
      }
    : {
        status,
        declined_at: new Date().toISOString()
      };

  debugLog("[challengeService] updating challenge status", {
    challengeId,
    status,
    updatePayload
  });

  try {
    const { data, error } = await supabase
      .from("challenges")
      .update(updatePayload)
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

    const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseProjectUrl || !supabaseAnonKey) {
      throw new Error("Supabase is not configured.");
    }

    const authHeaders = await getAuthenticatedRequestHeaders();
    const response = await fetch(`${supabaseProjectUrl}/functions/v1/create-challenge`, {
      method: "POST",
      headers: {
        ...authHeaders,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sportId: input.sportId,
        opponentProfileId: input.opponentProfileId,
        scheduledAt: input.scheduledAt,
        locationName: input.locationName,
        locationLatitude: input.locationLatitude,
        locationLongitude: input.locationLongitude,
        challengeType: input.challengeType,
        stakeType: input.stakeType,
        stakeLabel: input.stakeLabel,
        stakeNote: input.stakeNote,
        isOpen: input.isOpen ?? false
      })
    });
    const responsePayload = (await response.json().catch(() => null)) as CreateChallengeResponse | null;

    if (!response.ok) {
      throw new Error(responsePayload?.error ?? `Challenge creation failed with status ${response.status}`);
    }

    if (!responsePayload?.challenge) {
      throw new Error("Challenge was created but no row was returned.");
    }

    const challengeRow = responsePayload.challenge;

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
  return (await getChallengeInbox(profileId)).received;
}

export async function getSentChallengeInbox(profileId: string): Promise<ChallengeInboxItem[]> {
  return (await getChallengeInbox(profileId)).sent;
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
  const channelName = `challenge-activity-${profileId}-${Math.random().toString(36).slice(2, 10)}`;

  return supabase
    .channel(channelName)
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

export async function getOpenChallenges(sport: Challenge["sport"]): Promise<OpenChallenge[]> {
  try {
    const response = await getLoopTwoOpenChallenges(sport);
    return response.challenges;
  } catch (error) {
    debugError("[challengeService] failed to load open challenges", error, {
      sport
    });
    throw toServiceError(error, "Unable to load open challenges right now.");
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
