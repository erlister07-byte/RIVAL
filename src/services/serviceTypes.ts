import { Challenge, Match, Profile, RecentMatch } from "@/core/types/models";
import { NearbyPlayer, SuggestedOpponent } from "@/services/playerService";

export type UserProfileService = {
  createUserProfile: (...args: never[]) => Promise<Profile>;
  getUserProfile: (...args: never[]) => Promise<Profile | null>;
  updateUserProfile: (...args: never[]) => Promise<Profile>;
};

export type PlayerService = {
  getNearbyPlayers: (...args: never[]) => Promise<NearbyPlayer[]>;
  getSuggestedOpponents: (...args: never[]) => Promise<SuggestedOpponent[]>;
};

export type ChallengeService = {
  createChallenge: (...args: never[]) => Promise<Challenge>;
  getReceivedChallenges: (...args: never[]) => Promise<Challenge[]>;
  getSentChallenges: (...args: never[]) => Promise<Challenge[]>;
  acceptChallenge: (...args: never[]) => Promise<Challenge>;
  declineChallenge: (...args: never[]) => Promise<Challenge>;
};

export type MatchService = {
  submitMatchResult: (...args: never[]) => Promise<Match>;
  confirmMatchResult: (...args: never[]) => Promise<Match>;
  getProfileStats: (...args: never[]) => Promise<Pick<Profile, "wins" | "losses" | "matchesPlayed">>;
  getRecentMatches: (...args: never[]) => Promise<RecentMatch[]>;
};
