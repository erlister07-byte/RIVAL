import { Challenge, Match, Profile, RecentMatch, Sport } from "@/core/types/models";

export const sports: Sport[] = [
  { id: 3, slug: "pickleball", name: "Pickleball", isTeamSport: false },
  { id: 4, slug: "golf", name: "Golf", isTeamSport: false },
  { id: 1, slug: "tennis", name: "Tennis", isTeamSport: false },
  { id: 5, slug: "volleyball", name: "Volleyball", isTeamSport: true },
  { id: 2, slug: "basketball", name: "Basketball", isTeamSport: true },
  { id: 6, slug: "running", name: "Running", isTeamSport: false }
];

export const nearbySeedProfiles: Profile[] = [
  {
    id: "p-2",
    username: "maya.chen",
    email: "maya@example.com",
    displayName: "Maya Chen",
    vancouverArea: "Kitsilano",
    challengeRadiusKm: 8,
    onboardingCompleted: true,
    sports: [
      { sport: "tennis", skillLevel: "advanced" },
      { sport: "basketball", skillLevel: "intermediate" }
    ],
    availabilityStatus: "today",
    playStyleTags: ["competitive", "plays_for_coffee"],
    wins: 14,
    losses: 7,
    matchesPlayed: 21
  },
  {
    id: "p-3",
    username: "jordan.lee",
    email: "jordan@example.com",
    displayName: "Jordan Lee",
    vancouverArea: "Mount Pleasant",
    challengeRadiusKm: 12,
    onboardingCompleted: true,
    sports: [{ sport: "basketball", skillLevel: "competitive" }],
    availabilityStatus: "now",
    playStyleTags: ["casual", "beginner_friendly"],
    wins: 22,
    losses: 11,
    matchesPlayed: 33
  },
  {
    id: "p-4",
    username: "sam.patel",
    email: "sam@example.com",
    displayName: "Sam Patel",
    vancouverArea: "Downtown",
    challengeRadiusKm: 5,
    onboardingCompleted: true,
    sports: [{ sport: "tennis", skillLevel: "intermediate" }],
    availabilityStatus: "this_week",
    playStyleTags: ["bragging_rights"],
    wins: 9,
    losses: 10,
    matchesPlayed: 19
  }
];

export const initialChallenges: Challenge[] = [
  {
    id: "c-1",
    sport: "tennis",
    challengerProfileId: "p-2",
    opponentProfileId: "p-1",
    scheduledAt: "2026-03-19T18:30:00.000Z",
    locationName: "Kits Beach Courts",
    challengeType: "casual",
    stakeNote: "Loser buys smoothies",
    status: "pending",
    createdAt: "2026-03-16T18:00:00.000Z"
  },
  {
    id: "c-2",
    sport: "basketball",
    challengerProfileId: "p-1",
    opponentProfileId: "p-3",
    scheduledAt: "2026-03-20T02:00:00.000Z",
    locationName: "David Lam Park",
    challengeType: "ranked",
    status: "accepted",
    createdAt: "2026-03-16T17:00:00.000Z"
  }
];

export const initialMatches: Match[] = [
  {
    id: "m-1",
    challengeId: "c-2",
    sport: "basketball",
    challengerProfileId: "p-1",
    opponentProfileId: "p-3",
    locationName: "David Lam Park",
    playedAt: "2026-03-20T02:00:00.000Z",
    resultStatus: "pending_confirmation",
    submittedByProfileId: "p-1",
    winnerProfileId: "p-1",
    loserProfileId: "p-3",
    scoreSummary: "21 - 18",
    resultNotes: "Close game, best of one."
  }
];

export const initialRecentMatches: RecentMatch[] = [
  {
    id: "rm-1",
    sport: "tennis",
    opponentProfileId: "p-5",
    opponentName: "Alex Wong",
    scoreSummary: "6-4, 6-3",
    result: "win",
    date: "2026-03-10T18:00:00.000Z"
  },
  {
    id: "rm-2",
    sport: "basketball",
    opponentProfileId: "p-6",
    opponentName: "Chris Bell",
    scoreSummary: "17 - 21",
    result: "loss",
    date: "2026-03-07T20:00:00.000Z"
  }
];
