export type SportSlug = "golf" | "tennis" | "pickleball" | "volleyball" | "basketball" | "running";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "competitive";
export type AvailabilityStatus = "now" | "today" | "this_week" | "unavailable";
export type ChallengeStatus = "pending" | "accepted" | "declined" | "completed" | "canceled";
export type ChallengeType = "casual" | "practice" | "ranked";
export type MatchFormat = "singles" | "doubles";
export type MatchResultStatus = "pending_submission" | "pending_confirmation" | "confirmed" | "disputed";
export type ActivityEventType = "challenge_created" | "challenge_accepted" | "match_completed";
export type PlayStyleTag =
  | "competitive"
  | "casual"
  | "beginner_friendly"
  | "bragging_rights"
  | "plays_for_coffee"
  | "plays_for_drinks";

export const playStyleTagOptions: Array<{ value: PlayStyleTag; label: string }> = [
  { value: "competitive", label: "Competitive" },
  { value: "casual", label: "Casual" },
  { value: "beginner_friendly", label: "Beginner Friendly" },
  { value: "bragging_rights", label: "Bragging Rights" },
  { value: "plays_for_coffee", label: "Plays for Coffee" },
  { value: "plays_for_drinks", label: "Plays for Drinks" }
];

const playStyleTagLabels = new Map(playStyleTagOptions.map((option) => [option.value, option.label]));

export function isPlayStyleTag(value: string): value is PlayStyleTag {
  return playStyleTagLabels.has(value as PlayStyleTag);
}

export function normalizePlayStyleTags(values?: Array<string | null> | null): PlayStyleTag[] {
  const seen = new Set<PlayStyleTag>();

  (values ?? []).forEach((value) => {
    if (value && isPlayStyleTag(value) && seen.size < 3) {
      seen.add(value);
    }
  });

  return Array.from(seen);
}

export function getPlayStyleTagLabel(value: PlayStyleTag) {
  return playStyleTagLabels.get(value) ?? value;
}

export const visibleChallengeTypes: ChallengeType[] = ["casual", "ranked"];

export function getChallengeTypeLabel(value: ChallengeType) {
  switch (value) {
    case "ranked":
      return "Stakes Challenge";
    case "practice":
    case "casual":
    default:
      return "Bragging Rights";
  }
}

export function getStakeLabel(stakeLabel?: string | null) {
  return stakeLabel?.trim() ? stakeLabel.trim() : "Bragging Rights";
}

export function getStakeIcon(stakeType?: string | null) {
  switch (stakeType) {
    case "coffee":
      return "☕";
    case "drinks":
      return "🍺";
    case "court_fee":
      return "💰";
    case "custom":
      return "✍️";
    case "bragging_rights":
    default:
      return "🏆";
  }
}

export function getStakeDisplay(stakeType?: string | null, stakeLabel?: string | null) {
  return `${getStakeIcon(stakeType)} ${getStakeLabel(stakeLabel)}`;
}

export function getStakeOutcomeCopy({
  result,
  stakeType,
  stakeLabel
}: {
  result: "win" | "loss";
  stakeType?: string | null;
  stakeLabel?: string | null;
}) {
  const label = getStakeLabel(stakeLabel);
  const icon = getStakeIcon(stakeType);
  const normalizedStakeType = stakeType ?? "bragging_rights";

  if (result === "win") {
    switch (normalizedStakeType) {
      case "coffee":
        return `Coffee secured ${icon}`;
      case "drinks":
        return `Drinks secured ${icon}`;
      case "court_fee":
        return `Court fees covered ${icon}`;
      case "custom":
        return `${label} secured ${icon}`;
      case "bragging_rights":
      default:
        return `Bragging rights secured ${icon}`;
    }
  }

  switch (normalizedStakeType) {
    case "coffee":
      return `You owe coffee ${icon}`;
    case "drinks":
      return `You owe drinks ${icon}`;
    case "court_fee":
      return `You owe court fees ${icon}`;
    case "custom":
      return `${label} settled ${icon}`;
    case "bragging_rights":
    default:
      return `Bragging rights settled ${icon}`;
  }
}

export type Sport = {
  id: number;
  slug: SportSlug;
  name: string;
  isTeamSport: boolean;
};

export type PlayerSport = {
  sport: SportSlug;
  skillLevel: SkillLevel;
};

export type PlayerSummary = {
  id: string;
  username: string;
  displayName: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
  availabilityStatus: AvailabilityStatus;
  playStyleTags: PlayStyleTag[];
};

export type Profile = PlayerSummary & {
  firebaseUid?: string;
  email: string;
  vancouverArea: string;
  challengeRadiusKm: number;
  onboardingCompleted: boolean;
  sports: PlayerSport[];
};

export const availabilityOptions: AvailabilityStatus[] = ["now", "today", "this_week", "unavailable"];

export function getAvailabilityLabel(value: AvailabilityStatus) {
  switch (value) {
    case "now":
      return "Ready now";
    case "today":
      return "Free today";
    case "this_week":
      return "This week";
    case "unavailable":
    default:
      return "Unavailable";
  }
}

export function matchesAvailabilityIntent(
  value: AvailabilityStatus | undefined,
  intent: AvailabilityStatus | undefined
) {
  if (!intent) {
    return true;
  }

  const normalizedValue = value ?? "unavailable";

  if (intent === "now") {
    return normalizedValue === "now";
  }

  if (intent === "today") {
    return normalizedValue === "now" || normalizedValue === "today";
  }

  if (intent === "this_week") {
    return normalizedValue === "now" || normalizedValue === "today" || normalizedValue === "this_week";
  }

  return normalizedValue === "unavailable";
}

export type Challenge = {
  id: string;
  sport: SportSlug;
  challengerProfileId: string;
  opponentProfileId?: string;
  scheduledAt: string;
  locationName: string;
  challengeType: ChallengeType;
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
  status: ChallengeStatus;
  createdAt: string;
  isOpen?: boolean;
};

export type OpenChallenge = {
  id: string;
  challengerProfileId: string;
  challengerUsername: string;
  challengerDisplayName: string;
  challengerArea: string;
  sportId: number;
  sport: SportSlug;
  sportName: string;
  scheduledAt: string;
  locationName: string;
  challengeType: ChallengeType;
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
  createdAt: string;
  matchesPlayed?: number;
};

export type Match = {
  id: string;
  challengeId: string;
  sport: SportSlug;
  challengerProfileId: string;
  opponentProfileId: string;
  locationName: string;
  playedAt: string;
  resultStatus: MatchResultStatus;
  submittedByProfileId?: string;
  confirmedByProfileId?: string;
  winnerProfileId?: string;
  loserProfileId?: string;
  scoreSummary?: string;
  resultNotes?: string;
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
  confirmedAt?: string;
  resultConfirmationDeadlineAt?: string;
  resultConfirmationMethod?: "manual" | "auto";
};

export type RecentMatch = {
  id: string;
  sport: SportSlug;
  opponentProfileId: string;
  opponentName: string;
  scoreSummary: string;
  result: "win" | "loss";
  date: string;
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
};

export type RivalryRecord = {
  opponentProfileId: string;
  opponentDisplayName: string;
  wins: number;
  losses: number;
  totalMatches: number;
  latestWinnerProfileId?: string;
  latestMatchAt?: string;
  sportId?: number;
  sportName?: string;
};

export type ActivityEvent = {
  id: string;
  actorProfileId: string;
  targetProfileId?: string;
  challengeId?: string;
  matchId?: string;
  sport?: SportSlug;
  eventType: ActivityEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ActivityFeedItem = {
  id: string;
  actorDisplayName: string;
  title?: string;
  message: string;
  sportLabel?: string;
  createdAt: string;
  score?: string;
  locationName?: string;
  eventType: ActivityEventType;
};

export type LeaderboardEntry = {
  profile_id: string;
  display_name: string;
  matches_played: number;
  rank: number;
};
