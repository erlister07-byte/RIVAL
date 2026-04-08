import { LeaderboardEntry } from "@/core/types/models";
import { Database } from "@/types/database";

import { supabase } from "./supabaseClient";

type SportRow = Database["public"]["Tables"]["sports"]["Row"];

type LeaderboardProfileRow = {
  profile_id: string;
  profiles: {
    display_name: string;
    profile_stats:
      | Array<{
          matches_played: number | null;
        }>
      | null;
  } | null;
};

export async function getAvailableLeaderboardSports(): Promise<SportRow[]> {
  const { data, error } = await supabase
    .from("sports")
    .select("id, slug, name, is_team_sport, created_at, updated_at")
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SportRow[];
}

export async function getLeaderboardBySport(sportId: string, currentUserId: string): Promise<{
  leaderboard: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
}> {
  const { data, error } = await supabase
    .from("profile_sports")
    .select("profile_id, profiles!inner(display_name, profile_stats(matches_played))")
    .eq("sport_id", Number(sportId))
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  const leaderboard = ((data ?? []) as LeaderboardProfileRow[])
    .map((row) => ({
      profile_id: row.profile_id,
      display_name: row.profiles?.display_name ?? "Player",
      matches_played: row.profiles?.profile_stats?.[0]?.matches_played ?? 0,
      rank: 0
    }))
    .sort((left, right) => {
      if (left.matches_played !== right.matches_played) {
        return right.matches_played - left.matches_played;
      }

      return left.display_name.localeCompare(right.display_name);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

  return {
    leaderboard,
    currentUserEntry: leaderboard.find((entry) => entry.profile_id === currentUserId) ?? null
  };
}
