import { RivalryRecord } from "@/core/types/models";
import { Database } from "@/types/database";

import { supabase } from "./supabaseClient";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type SportRow = Database["public"]["Tables"]["sports"]["Row"];

type ConfirmedMatchRow = MatchRow & {
  sports: SportRow | null;
};

type OpponentProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name">;

function buildRivalryRecord(
  currentProfileId: string,
  opponentProfileId: string,
  opponentDisplayName: string,
  rows: ConfirmedMatchRow[]
): RivalryRecord {
  const orderedRows = [...rows].sort((left, right) => {
    const leftTime = new Date(left.confirmed_at ?? left.updated_at).getTime();
    const rightTime = new Date(right.confirmed_at ?? right.updated_at).getTime();
    return rightTime - leftTime;
  });

  const wins = orderedRows.filter((row) => row.winner_profile_id === currentProfileId).length;
  const losses = orderedRows.filter((row) => row.loser_profile_id === currentProfileId).length;
  const latestRow = orderedRows[0];

  return {
    opponentProfileId,
    opponentDisplayName,
    wins,
    losses,
    totalMatches: orderedRows.length,
    latestWinnerProfileId: latestRow?.winner_profile_id ?? undefined,
    latestMatchAt: latestRow?.confirmed_at ?? latestRow?.updated_at ?? undefined,
    sportId: latestRow?.sport_id ?? undefined,
    sportName: latestRow?.sports?.name ?? undefined
  };
}

export function formatRivalrySummary(record: RivalryRecord) {
  return `${record.wins}-${record.losses}`;
}

export async function getHeadToHeadRecord(
  currentProfileId: string,
  opponentProfileId: string,
  sportId?: string
): Promise<RivalryRecord | null> {
  let query = supabase
    .from("matches")
    .select("*, sports(*)")
    .eq("result_status", "confirmed")
    .or(
      `and(challenger_profile_id.eq.${currentProfileId},opponent_profile_id.eq.${opponentProfileId}),and(challenger_profile_id.eq.${opponentProfileId},opponent_profile_id.eq.${currentProfileId})`
    );

  if (sportId) {
    query = query.eq("sport_id", Number(sportId));
  }

  const { data, error } = await query.order("confirmed_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ConfirmedMatchRow[];

  if (rows.length === 0) {
    return null;
  }

  const { data: opponentData, error: opponentError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", opponentProfileId)
    .maybeSingle<OpponentProfileRow>();

  if (opponentError) {
    throw opponentError;
  }

  return buildRivalryRecord(
    currentProfileId,
    opponentProfileId,
    opponentData?.display_name ?? "Opponent",
    rows
  );
}

export async function getTopRivalries(
  currentProfileId: string,
  limit = 5
): Promise<RivalryRecord[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*, sports(*)")
    .eq("result_status", "confirmed")
    .or(`challenger_profile_id.eq.${currentProfileId},opponent_profile_id.eq.${currentProfileId}`)
    .order("confirmed_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ConfirmedMatchRow[];

  if (rows.length === 0) {
    return [];
  }

  const groupedRows = new Map<string, ConfirmedMatchRow[]>();

  for (const row of rows) {
    const opponentProfileId =
      row.challenger_profile_id === currentProfileId ? row.opponent_profile_id : row.challenger_profile_id;
    const existingRows = groupedRows.get(opponentProfileId) ?? [];
    existingRows.push(row);
    groupedRows.set(opponentProfileId, existingRows);
  }

  const opponentIds = Array.from(groupedRows.keys());
  const { data: opponents, error: opponentsError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", opponentIds);

  if (opponentsError) {
    throw opponentsError;
  }

  const opponentNameById = new Map(
    ((opponents ?? []) as OpponentProfileRow[]).map((opponent) => [opponent.id, opponent.display_name])
  );

  return opponentIds
    .map((opponentProfileId) =>
      buildRivalryRecord(
        currentProfileId,
        opponentProfileId,
        opponentNameById.get(opponentProfileId) ?? "Opponent",
        groupedRows.get(opponentProfileId) ?? []
      )
    )
    .sort((left, right) => {
      if (left.totalMatches !== right.totalMatches) {
        return right.totalMatches - left.totalMatches;
      }

      return new Date(right.latestMatchAt ?? 0).getTime() - new Date(left.latestMatchAt ?? 0).getTime();
    })
    .slice(0, limit);
}
