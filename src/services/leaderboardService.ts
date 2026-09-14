import { LeaderboardEntry } from "@/core/types/models";
import { Database } from "@/types/database";

import { getAuthenticatedRequestHeaders } from "./authSession";
import { supabase } from "./supabaseClient";

type SportRow = Database["public"]["Tables"]["sports"]["Row"];

type LeaderboardResponseEntry = {
  rank: number;
  profileId: string;
  displayName: string;
  username: string;
  matchesPlayed: number;
};

type LeaderboardResponse = {
  sport: {
    id: number;
    slug: string;
    name: string;
  };
  entries: LeaderboardResponseEntry[];
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

export async function getLeaderboardBySport(sport: string, currentUserId: string): Promise<{
  leaderboard: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
}> {
  const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseProjectUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured.");
  }

  const authHeaders = await getAuthenticatedRequestHeaders();
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/get-leaderboard`, {
    method: "POST",
    headers: {
      ...authHeaders,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sport })
  });
  const payload = (await response.json().catch(() => null)) as (LeaderboardResponse & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Unable to load leaderboard (${response.status}).`);
  }

  if (!payload || !Array.isArray(payload.entries)) {
    throw new Error("Leaderboard service returned an invalid response.");
  }

  const leaderboard = payload.entries.map((entry) => ({
    profile_id: entry.profileId,
    display_name: entry.displayName,
    matches_played: entry.matchesPlayed,
    rank: entry.rank
  }));

  return {
    leaderboard,
    currentUserEntry: leaderboard.find((entry) => entry.profile_id === currentUserId) ?? null
  };
}
