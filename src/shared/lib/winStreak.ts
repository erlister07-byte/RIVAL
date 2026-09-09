import type { MatchResultOutcome, MatchResultStatus } from "@/core/types/models";

export type OrderedWinStreakMatch = {
  challengerProfileId: string | null;
  opponentProfileId: string | null;
  resultStatus: MatchResultStatus | null;
  resultOutcome: MatchResultOutcome | null;
  winnerProfileId: string | null;
};

export function getCurrentWinStreak(
  orderedMatches: OrderedWinStreakMatch[],
  profileId: string
) {
  if (!profileId) {
    return 0;
  }

  let streak = 0;

  for (const match of orderedMatches) {
    if (match.resultStatus !== "confirmed") {
      continue;
    }

    const hasValidParticipants =
      match.challengerProfileId !== null &&
      match.opponentProfileId !== null &&
      match.challengerProfileId !== match.opponentProfileId &&
      (profileId === match.challengerProfileId || profileId === match.opponentProfileId);

    if (!hasValidParticipants || match.resultOutcome !== "win") {
      break;
    }

    if (match.winnerProfileId !== profileId) {
      break;
    }

    streak += 1;
  }

  return streak;
}
