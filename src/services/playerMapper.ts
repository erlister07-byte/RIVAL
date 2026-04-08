import { AvailabilityStatus, PlayerSummary, normalizePlayStyleTags } from "@/core/types/models";
import { withOptionalFieldFallback } from "@/shared/lib/schemaDrift";

type JoinedProfileStats =
  | {
      wins?: number | null;
      losses?: number | null;
      matches_played?: number | null;
    }
  | Array<{
      wins?: number | null;
      losses?: number | null;
      matches_played?: number | null;
    }>
  | null
  | undefined;

type PlayerSummaryRow = {
  id: string;
  username: string;
  display_name: string;
  availability_status?: string | null;
  play_style_tags?: string[] | null;
  profile_stats?: JoinedProfileStats;
};

function getStats(stats: JoinedProfileStats) {
  if (Array.isArray(stats)) {
    return stats[0] ?? null;
  }

  return stats ?? null;
}

export function mapPlayerSummary(row: PlayerSummaryRow): PlayerSummary {
  const stats = getStats(row.profile_stats);

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    availabilityStatus: withOptionalFieldFallback(row.availability_status as AvailabilityStatus | null, "unavailable"),
    playStyleTags: normalizePlayStyleTags(row.play_style_tags),
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    matchesPlayed: stats?.matches_played ?? 0
  };
}
