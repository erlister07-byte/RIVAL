import { AppStackParamList } from "@/application/navigation/types";
import { getSportIdBySlug } from "@/config/sports";
import { AvailabilityStatus, SportSlug } from "@/core/types/models";

type RematchChallengeInput = {
  opponentProfileId: string;
  opponentName: string;
  opponentUsername?: string;
  sport: SportSlug;
  timingContext?: AvailabilityStatus;
};

export function buildRematchChallengeParams({
  opponentProfileId,
  opponentName,
  opponentUsername,
  sport,
  timingContext
}: RematchChallengeInput): NonNullable<AppStackParamList["CreateChallenge"]> {
  return {
    opponentId: opponentProfileId,
    opponentName,
    ...(opponentUsername ? { opponentUsername } : {}),
    sport,
    sportId: getSportIdBySlug(sport),
    isRematch: true,
    ...(timingContext ? { timingContext } : {})
  };
}
