import { AvailabilityStatus, SportSlug } from "@/core/types/models";

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  Login: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
};

export type NearbyPlayersRouteParams =
  | {
      sport?: SportSlug;
      availability?: AvailabilityStatus;
      mode?: "nearby" | "play_now";
    }
  | undefined;

export type LoopOneStackParamList = {
  NearbyPlayers: NearbyPlayersRouteParams;
};

export type LoopTwoStackParamList = {
  NearbyPlayers: NearbyPlayersRouteParams;
  CreateChallenge: NonNullable<AppStackParamList["CreateChallenge"]>;
  ChallengeInbox: undefined;
  MatchInbox: undefined;
  SubmitMatchResult: { matchId: string };
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
  NearbyPlayers: NearbyPlayersRouteParams;
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
