import { RivalryRecord } from "@/core/types/models";
import { getUserMatches, LoopTwoMatch } from "./matchService";

function buildRivalryRecord(
  currentProfileId: string,
  opponentProfileId: string,
  opponentDisplayName: string,
  rows: LoopTwoMatch[]
): RivalryRecord {
  const orderedRows = [...rows].sort((left, right) => {
    const leftTime = new Date(left.confirmedAt ?? left.updatedAt ?? left.scheduledAt ?? 0).getTime();
    const rightTime = new Date(right.confirmedAt ?? right.updatedAt ?? right.scheduledAt ?? 0).getTime();
    return rightTime - leftTime;
  });

  const wins = orderedRows.filter((row) => row.winnerProfileId === currentProfileId).length;
  const losses = orderedRows.filter((row) => row.loserProfileId === currentProfileId).length;
  const draws = orderedRows.filter((row) => row.resultOutcome === "draw").length;
  const latestRow = orderedRows[0];
  const latestResult = latestRow?.resultOutcome === "draw"
    ? "draw"
    : latestRow?.winnerProfileId === currentProfileId
      ? "win"
      : latestRow
        ? "loss"
        : undefined;

  return {
    opponentProfileId,
    opponentDisplayName,
    wins,
    losses,
    draws,
    totalMatches: orderedRows.length,
    latestWinnerProfileId: latestRow?.winnerProfileId ?? undefined,
    latestResult,
    latestMatchAt: latestRow?.confirmedAt ?? latestRow?.updatedAt ?? latestRow?.scheduledAt ?? undefined,
    sportId: latestRow?.sportId ?? undefined,
    sportName: latestRow?.sportName ?? undefined
  };
}

export function formatRivalrySummary(record: RivalryRecord) {
  return `${record.wins}-${record.losses}-${record.draws}`;
}

export async function getHeadToHeadRecord(
  currentProfileId: string,
  opponentProfileId: string,
  sportId?: string
): Promise<RivalryRecord | null> {
  const rows = (await getUserMatches()).filter(
    (match) =>
      match.resultStatus === "confirmed" &&
      (match.challenger.profileId === currentProfileId || match.opponent.profileId === currentProfileId) &&
      match.counterpart.profileId === opponentProfileId &&
      (!sportId || match.sportId === Number(sportId))
  );

  if (rows.length === 0) {
    return null;
  }

  return buildRivalryRecord(
    currentProfileId,
    opponentProfileId,
    rows[0]?.counterpart.displayName?.trim() || rows[0]?.counterpart.username?.trim() || "Opponent",
    rows
  );
}

export async function getTopRivalries(
  currentProfileId: string,
  limit = 5
): Promise<RivalryRecord[]> {
  const rows = (await getUserMatches()).filter(
    (match) =>
      match.resultStatus === "confirmed" &&
      (match.challenger.profileId === currentProfileId || match.opponent.profileId === currentProfileId)
  );

  if (rows.length === 0) {
    return [];
  }

  const groupedRows = new Map<string, LoopTwoMatch[]>();

  for (const row of rows) {
    const opponentProfileId = row.counterpart.profileId;
    const existingRows = groupedRows.get(opponentProfileId) ?? [];
    existingRows.push(row);
    groupedRows.set(opponentProfileId, existingRows);
  }

  const opponentIds = Array.from(groupedRows.keys());

  return opponentIds
    .map((opponentProfileId) =>
      buildRivalryRecord(
        currentProfileId,
        opponentProfileId,
        groupedRows.get(opponentProfileId)?.[0]?.counterpart.displayName?.trim() ||
          groupedRows.get(opponentProfileId)?.[0]?.counterpart.username?.trim() ||
          "Opponent",
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
