export type LevelProgress = {
  xp: number;
  level: number;
  currentThreshold: number;
  nextThreshold: number;
  xpIntoLevel: number;
  xpRequiredForNextLevel: number;
  xpRemaining: number;
  progressRatio: number;
};

function normalizeXp(xp: number | null | undefined) {
  if (typeof xp !== "number" || !Number.isFinite(xp) || xp <= 0) {
    return 0;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(xp));
}

function normalizeLevel(level: number) {
  if (!Number.isFinite(level) || level <= 1) {
    return 1;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(level));
}

export function getLevelThreshold(level: number) {
  const normalizedLevel = normalizeLevel(level);
  return 50 * (normalizedLevel - 1) * (normalizedLevel + 4);
}

export function getLevelFromXp(xp: number | null | undefined) {
  const normalizedXp = normalizeXp(xp);
  const estimatedLevel = Math.floor((Math.sqrt(25 + (2 * normalizedXp) / 25) - 3) / 2);
  let level = Math.max(1, estimatedLevel);

  while (getLevelThreshold(level + 1) <= normalizedXp) {
    level += 1;
  }

  while (level > 1 && getLevelThreshold(level) > normalizedXp) {
    level -= 1;
  }

  return level;
}

export function getLevelProgress(xp: number | null | undefined): LevelProgress {
  const normalizedXp = normalizeXp(xp);
  const level = getLevelFromXp(normalizedXp);
  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = getLevelThreshold(level + 1);
  const xpIntoLevel = Math.max(0, normalizedXp - currentThreshold);
  const xpRequiredForNextLevel = Math.max(0, nextThreshold - currentThreshold);
  const xpRemaining = Math.max(0, nextThreshold - normalizedXp);
  const progressRatio = xpRequiredForNextLevel > 0
    ? Math.min(1, Math.max(0, xpIntoLevel / xpRequiredForNextLevel))
    : 0;

  return {
    xp: normalizedXp,
    level,
    currentThreshold,
    nextThreshold,
    xpIntoLevel,
    xpRequiredForNextLevel,
    xpRemaining,
    progressRatio
  };
}
