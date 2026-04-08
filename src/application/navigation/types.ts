import { AvailabilityStatus, SportSlug } from "@/core/types/models";

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  Login: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  ActivityFeed: undefined;
  ChallengeInbox: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Leaderboard: undefined;
  FriendSearch: undefined;
  NearbyPlayers:
    | {
        sport?: SportSlug;
        availability?: AvailabilityStatus;
        mode?: "nearby" | "play_now";
      }
    | undefined;
  Messages: undefined;
  Chat: {
    threadId: string;
    opponentName?: string;
    sport?: string;
  };
  CreateChallenge:
    | {
        mode?: "direct" | "open";
        opponentId?: string;
        opponentUsername?: string;
        opponentName?: string;
        sportId?: number;
        sport?: SportSlug;
        locationName?: string;
        timingContext?: AvailabilityStatus;
        stakeNote?: string;
        isRematch?: boolean;
      }
    | undefined;
  ResultsInbox: undefined;
  MatchResultSubmission: { matchId: string };
  ConfirmResult: { matchId: string };
};
