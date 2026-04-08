import { Match, RecentMatch } from "@/core/types/models";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Database, Json } from "@/types/database";
import { DEFAULT_LAUNCH_SPORT } from "@/config/sports";
import { debugError, debugLog, getSafeErrorPayload } from "@/shared/lib/logger";
import { toServiceError } from "@/shared/lib/serviceError";

import { createActivityEvent } from "./activityService";
import { applyMatchRatingUpdate } from "./ratingService";
import { supabase } from "./supabaseClient";
import { getRecentMatches as getUserRecentMatches, getProfileStats } from "./userService";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type SportRow = Database["public"]["Tables"]["sports"]["Row"];
type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];

export type SubmitMatchResultInput = {
  matchId: string;
  submittedByProfileId: string;
  winnerProfileId: string;
  loserProfileId: string;
  scoreSummary?: string | null;
  resultNotes?: string | null;
};

type MatchRowWithSport = MatchRow & {
  sports: SportRow | null;
  challenges?: {
    stake_type?: string | null;
    stake_label?: string | null;
    stake_note?: string | null;
  } | null;
};

type MatchRowWithRelations = MatchRowWithSport & {
  sports: SportRow | null;
  challenges: {
    id: string;
    status: ChallengeStatus;
    stake_type?: string | null;
    stake_label?: string | null;
    stake_note?: string | null;
  } | null;
};

function getRealtimeMatchRow(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
): Partial<MatchRow> | null {
  if (payload.eventType === "DELETE") {
    return (payload.old as Partial<MatchRow>) ?? null;
  }

  return (payload.new as Partial<MatchRow>) ?? null;
}

function isRelevantMatchRealtimeEvent(
  profileId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
) {
  const row = getRealtimeMatchRow(payload);

  if (!row) {
    return false;
  }

  return row.opponent_profile_id === profileId || row.challenger_profile_id === profileId;
}

export type MatchForSubmission = Match & {
  challengeStatus: ChallengeStatus;
  challengerName: string;
  opponentName: string;
};

export function isActionableResultMatch(match: Match, profileId?: string) {
  if (!profileId) {
    return false;
  }

  const isParticipant = match.challengerProfileId === profileId || match.opponentProfileId === profileId;

  if (!isParticipant) {
    return false;
  }

  if (match.resultStatus === "pending_submission") {
    return true;
  }

  if (match.resultStatus === "pending_confirmation") {
    return match.submittedByProfileId !== profileId;
  }

  return false;
}

export function formatResultConfirmationDeadline(deadlineAt?: string) {
  if (!deadlineAt) {
    return "Opponent has 24 hours to respond.";
  }

  const remainingMinutes = Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 60000);

  if (remainingMinutes <= 0) {
    return "Auto-confirm is processing.";
  }

  if (remainingMinutes >= 60) {
    return `Auto-confirms in ${Math.ceil(remainingMinutes / 60)}h`;
  }

  return `Auto-confirms in ${remainingMinutes}m`;
}

function mapMatch(row: MatchRowWithSport): Match {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    sport: row.sports?.slug ?? DEFAULT_LAUNCH_SPORT,
    challengerProfileId: row.challenger_profile_id,
    opponentProfileId: row.opponent_profile_id,
    locationName: row.location_name,
    playedAt: row.played_at ?? row.created_at,
    resultStatus: row.result_status,
    submittedByProfileId: row.submitted_by_profile_id ?? undefined,
    confirmedByProfileId: row.confirmed_by_profile_id ?? undefined,
    winnerProfileId: row.winner_profile_id ?? undefined,
    loserProfileId: row.loser_profile_id ?? undefined,
    scoreSummary: row.score_summary ?? undefined,
    resultNotes: row.result_notes ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    resultConfirmationDeadlineAt: row.result_confirmation_deadline_at ?? undefined,
    resultConfirmationMethod:
      row.result_confirmation_method === "manual" || row.result_confirmation_method === "auto"
        ? row.result_confirmation_method
        : undefined,
    stakeType: row.challenges?.stake_type ?? undefined,
    stakeLabel: row.challenges?.stake_label ?? undefined,
    stakeNote: row.challenges?.stake_note ?? undefined
  };
}

async function getParticipantNames(challengerProfileId: string, opponentProfileId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [challengerProfileId, opponentProfileId]);

  if (error) {
    throw error;
  }

  const namesById = new Map((data ?? []).map((profile) => [profile.id, profile.display_name]));

  return {
    challengerName: namesById.get(challengerProfileId) ?? "Challenger",
    opponentName: namesById.get(opponentProfileId) ?? "Opponent"
  };
}

export async function getMatchForSubmission(matchId: string): Promise<MatchForSubmission> {
  debugLog("[matchService] loading match for submission", { matchId });

  await autoConfirmOverdueMatchResults();

  const { data, error } = await supabase
    .from("matches")
    .select("*, sports(*), challenges!inner(id, status, stake_type, stake_label, stake_note)")
    .eq("id", matchId)
    .single();

  if (error) {
    debugError("[matchService] failed to load match for submission", error, { matchId });
    throw error;
  }

  const row = data as MatchRowWithRelations;
  const names = await getParticipantNames(row.challenger_profile_id, row.opponent_profile_id);

  return {
    ...mapMatch(row),
    challengeStatus: row.challenges?.status ?? "pending",
    challengerName: names.challengerName,
    opponentName: names.opponentName
  };
}

export async function getMatchForConfirmation(matchId: string): Promise<MatchForSubmission> {
  return getMatchForSubmission(matchId);
}

export async function submitMatchResult(input: SubmitMatchResultInput): Promise<Match> {
  try {
    debugLog("[matchService] submitting match result", {
      matchId: input.matchId,
      submittedByProfileId: input.submittedByProfileId,
      winnerProfileId: input.winnerProfileId,
      loserProfileId: input.loserProfileId
    });
    const currentMatch = await getMatchForSubmission(input.matchId);

    if (currentMatch.challengeStatus !== "accepted") {
      throw new Error("Only accepted challenges can move to result submission.");
    }

    if (currentMatch.resultStatus !== "pending_submission") {
      throw new Error("This result can no longer be submitted from its current state.");
    }

    const participantIds = [currentMatch.challengerProfileId, currentMatch.opponentProfileId];

    if (!participantIds.includes(input.submittedByProfileId)) {
      throw new Error("Only challenge participants can submit a result.");
    }

    if (!participantIds.includes(input.winnerProfileId) || !participantIds.includes(input.loserProfileId)) {
      throw new Error("Winner and loser must be challenge participants.");
    }

    if (input.winnerProfileId === input.loserProfileId) {
      throw new Error("Winner and loser cannot be the same player.");
    }

    // The submitter only proposes a result. Stats change only after the opponent confirms it.
    debugLog("[matchService] submit match result rpc payload", {
      matchId: input.matchId,
      userId: input.submittedByProfileId,
      submittedByProfileId: input.submittedByProfileId,
      winnerProfileId: input.winnerProfileId,
      loserProfileId: input.loserProfileId,
      scoreSummary: input.scoreSummary ?? null,
      resultNotes: input.resultNotes ?? null
    });

    const { data: rpcData, error: rpcError } = await supabase.rpc("submit_match_result", {
      target_match_id: input.matchId,
      submitter_profile_id_param: input.submittedByProfileId,
      winner_profile_id_param: input.winnerProfileId,
      loser_profile_id_param: input.loserProfileId,
      score_summary_param: input.scoreSummary ?? null,
      result_notes_param: input.resultNotes ?? null
    });

    debugLog("[matchService] submit match result rpc response", {
      matchId: input.matchId,
      userId: input.submittedByProfileId,
      hasMatch: Boolean(rpcData),
      rpcError: rpcError ? getSafeErrorPayload(rpcError) : null
    });

    if (rpcError) {
      console.error("[matchService] submit match result rpc failed", {
        matchId: input.matchId,
        submittedByProfileId: input.submittedByProfileId,
        error: rpcError,
        safeError: getSafeErrorPayload(rpcError)
      });
      throw rpcError;
    }

    if (!rpcData) {
      throw new Error(`No match was returned for id ${input.matchId}.`);
    }

    const { data, error } = await supabase
      .from("matches")
      .select("*, sports(*)")
      .eq("id", input.matchId)
      .single();

    debugLog("[matchService] submitted match reload response", {
      matchId: input.matchId,
      submittedByProfileId: input.submittedByProfileId,
      hasMatch: Boolean(data),
      resultStatus: data?.result_status ?? null
    });

    if (error) {
      throw error;
    }

    const submittedMatchRow = data as MatchRowWithSport;

    if (submittedMatchRow.result_status !== "pending_confirmation") {
      throw new Error(
        `Result submission did not persist. Match is still ${submittedMatchRow.result_status}.`
      );
    }

    return mapMatch(submittedMatchRow);
  } catch (error) {
    debugError("[matchService] failed to submit match result", error, {
      matchId: input.matchId,
      submittedByProfileId: input.submittedByProfileId
    });
    throw toServiceError(error, "Unable to record the match result.");
  }
}

export async function autoConfirmOverdueMatchResults(profileId?: string): Promise<Match[]> {
  try {
    const { data, error } = await supabase.rpc("auto_confirm_overdue_match_results", {
      p_profile_id: profileId ?? null
    });

    if (error) {
      throw error;
    }

    const autoConfirmedRows = (data ?? []) as MatchRow[];

    if (autoConfirmedRows.length === 0) {
      return [];
    }

    const { data: reloadedRows, error: reloadError } = await supabase
      .from("matches")
      .select("*, sports(*)")
      .in(
        "id",
        autoConfirmedRows.map((row) => row.id)
      );

    if (reloadError) {
      throw reloadError;
    }

    return ((reloadedRows ?? []) as MatchRowWithSport[]).map(mapMatch);
  } catch (error) {
    debugError("[matchService] failed to auto-confirm overdue match results", error, {
      profileId: profileId ?? null
    });
    throw toServiceError(error, "Unable to refresh overdue match results.");
  }
}

export async function confirmMatchResult(
  matchId: string,
  confirmedByProfileId: string
): Promise<Match> {
  try {
    debugLog("[matchService] confirming match result", {
      matchId,
      confirmedByProfileId
    });
    const currentMatch = await getMatchForConfirmation(matchId);

    if (currentMatch.challengeStatus !== "accepted") {
      throw new Error("Only accepted challenges can be confirmed.");
    }

    if (currentMatch.resultStatus !== "pending_confirmation") {
      throw new Error("This result is not waiting for confirmation.");
    }

    const participantIds = [currentMatch.challengerProfileId, currentMatch.opponentProfileId];

    if (!participantIds.includes(confirmedByProfileId)) {
      throw new Error("Only challenge participants can confirm a result.");
    }

    if (currentMatch.submittedByProfileId === confirmedByProfileId) {
      throw new Error("The submitting player cannot confirm their own result.");
    }

    // Trust model: one player submits, the other player confirms before stats can count.
    const { data: rpcData, error: rpcError } = await supabase.rpc("confirm_match_result", {
      match_id: matchId,
      confirmer_profile_id: confirmedByProfileId
    });

    debugLog("[matchService] confirm match result rpc response", {
      matchId,
      confirmedByProfileId,
      dataReturned: rpcData !== null && rpcData !== undefined,
      rpcData,
      rpcError: rpcError ? getSafeErrorPayload(rpcError) : null
    });

    if (rpcError) {
      throw rpcError;
    }

    // Rating is a deferred legacy feature; the live DB no longer reliably supports the
    // old rating path, so match confirmation must stay successful even if this fails.
    // Revisit only when rating is intentionally restored in both schema and UI.
    try {
      await applyMatchRatingUpdate(matchId);
    } catch (ratingError) {
      debugError("[matchService] rating update skipped", ratingError, { matchId });
    }

    const { data, error } = await supabase
      .from("matches")
      .select("*, sports(*)")
      .eq("id", matchId)
      .single();

    debugLog("[matchService] confirmed match reload response", {
      matchId,
      confirmedByProfileId,
      hasMatch: Boolean(data),
      resultStatus: data?.result_status ?? null,
      confirmedAt: data?.confirmed_at ?? null
    });

    if (error) {
      throw error;
    }

    const confirmedMatchRow = data as MatchRowWithSport;

    if (confirmedMatchRow.result_status !== "confirmed") {
      const persistenceError = new Error(
        `Result confirmation did not persist. Match is still ${confirmedMatchRow.result_status}.`
      );
      console.error("[matchService] confirm result persistence check failed", {
        matchId,
        confirmedByProfileId,
        rpcData,
        reloadedMatch: confirmedMatchRow
      });
      throw persistenceError;
    }

    const actorProfileId = confirmedMatchRow.winner_profile_id;
    const targetProfileId = confirmedMatchRow.loser_profile_id;
    const actorDisplayName =
      actorProfileId === currentMatch.challengerProfileId
        ? currentMatch.challengerName
        : currentMatch.opponentName;
    const opponentDisplayName =
      targetProfileId === currentMatch.challengerProfileId
        ? currentMatch.challengerName
        : currentMatch.opponentName;

    if (actorProfileId) {
      try {
        const metadata: Json = {
          actor_display_name: actorDisplayName,
          opponent_display_name: opponentDisplayName,
          target_display_name: opponentDisplayName,
          sport_name: confirmedMatchRow.sports?.name,
          score: confirmedMatchRow.score_summary,
          location: confirmedMatchRow.location_name,
          challenge_location: confirmedMatchRow.location_name
        };

        await createActivityEvent({
          actorProfileId,
          targetProfileId,
          challengeId: confirmedMatchRow.challenge_id,
          matchId: confirmedMatchRow.id,
          sportId: confirmedMatchRow.sports?.id ?? null,
          eventType: "match_completed",
          metadata
        });
      } catch (activityError) {
        debugError("Failed to log match completed activity", activityError, {
          matchId: confirmedMatchRow.id
        });
      }
    }

    return mapMatch(confirmedMatchRow);
  } catch (error) {
    debugError("[matchService] failed to confirm match result", error, {
      matchId,
      confirmedByProfileId
    });
    throw toServiceError(error, "Unable to confirm result.");
  }
}

export async function rejectMatchResult(
  matchId: string,
  rejectedByProfileId: string
): Promise<Match> {
  try {
    debugLog("[matchService] rejecting match result", {
      matchId,
      rejectedByProfileId
    });
    const currentMatch = await getMatchForConfirmation(matchId);

    if (currentMatch.challengeStatus !== "accepted") {
      throw new Error("Only accepted challenges can have result disputes.");
    }

    if (currentMatch.resultStatus !== "pending_confirmation") {
      throw new Error("Only submitted results can be rejected.");
    }

    const participantIds = [currentMatch.challengerProfileId, currentMatch.opponentProfileId];

    if (!participantIds.includes(rejectedByProfileId)) {
      throw new Error("Only challenge participants can reject a result.");
    }

    if (currentMatch.submittedByProfileId === rejectedByProfileId) {
      throw new Error("The submitting player cannot reject their own result.");
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("reject_match_result", {
      target_match_id: matchId,
      rejecting_profile_id: rejectedByProfileId
    });

    debugLog("[matchService] reject match result rpc response", {
      matchId,
      rejectedByProfileId,
      dataReturned: rpcData !== null && rpcData !== undefined,
      rpcError: rpcError ? getSafeErrorPayload(rpcError) : null
    });

    if (rpcError) {
      throw rpcError;
    }

    const { data, error } = await supabase
      .from("matches")
      .select("*, sports(*)")
      .eq("id", matchId)
      .single();

    debugLog("[matchService] rejected match reload response", {
      matchId,
      rejectedByProfileId,
      hasMatch: Boolean(data),
      resultStatus: data?.result_status ?? null
    });

    if (error) {
      throw error;
    }

    const rejectedMatchRow = data as MatchRowWithSport;

    if (rejectedMatchRow.result_status !== "disputed") {
      throw new Error(`Result rejection did not persist. Match is still ${rejectedMatchRow.result_status}.`);
    }

    return mapMatch(rejectedMatchRow);
  } catch (error) {
    debugError("[matchService] failed to reject match result", error, {
      matchId,
      rejectedByProfileId
    });
    throw toServiceError(error, "Unable to dispute result.");
  }
}

export { getProfileStats };
export async function getMatchesForProfile(profileId: string): Promise<Match[]> {
  debugLog("[matchService] loading matches for profile", { profileId });

  await autoConfirmOverdueMatchResults(profileId);

  // MVP note: per-player match volume is still small enough to load in one query.
  // Add cursor pagination here before expanding match history significantly.
  const { data, error } = await supabase
    .from("matches")
    .select("*, sports(*)")
    .or(`challenger_profile_id.eq.${profileId},opponent_profile_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) {
    debugError("[matchService] failed to load matches for profile", error, { profileId });
    throw error;
  }

  return ((data ?? []) as MatchRowWithSport[]).map(mapMatch);
}

export async function getRecentMatches(profileId: string): Promise<RecentMatch[]> {
  return getUserRecentMatches(profileId);
}

export function subscribeToMatchActivity(
  profileId: string,
  onRelevantChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`match-activity-${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches"
      },
      (payload) => {
        if (!isRelevantMatchRealtimeEvent(profileId, payload)) {
          return;
        }

        debugLog("[matchService] realtime match activity received", {
          profileId,
          eventType: payload.eventType
        });
        onRelevantChange();
      }
    )
    .subscribe();
}
