import { SkillLevel, SportSlug } from "@/core/types/models";
import { getAuthenticatedRequestHeaders } from "./authSession";

export type OpponentProfile = {
  id: string;
  username: string;
  displayName: string;
  area: string | null;
  sports: Array<{ sport: SportSlug; selfAssessedSkill: SkillLevel; skillRating: number | null }>;
  record: { wins: number; losses: number; draws: number; matchesPlayed: number };
};

export class OpponentUnavailableError extends Error {}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sports = new Set(["golf", "tennis", "pickleball", "volleyball", "basketball", "running"]);
const skills = new Set(["beginner", "intermediate", "advanced", "competitive"]);

export async function getOpponentProfile(profileId: string): Promise<OpponentProfile> {
  if (!uuidPattern.test(profileId)) throw new OpponentUnavailableError("Profile unavailable");
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error("Supabase is not configured");
  const url = new URL(`${baseUrl}/functions/v1/get-opponent-profile`);
  url.searchParams.set("profileId", profileId);
  const response = await fetch(url.toString(), {
    headers: { ...(await getAuthenticatedRequestHeaders()), apikey: anonKey }
  });
  if (response.status === 404 || response.status === 409) throw new OpponentUnavailableError("Profile unavailable");
  if (!response.ok) throw new Error("Unable to load opponent profile");
  const payload: unknown = await response.json();
  const profile = typeof payload === "object" && payload !== null && "profile" in payload ? payload.profile : null;
  if (typeof profile !== "object" || profile === null) throw new Error("Invalid opponent profile response");
  const row = profile as Record<string, unknown>;
  const record = row.record as Record<string, unknown> | null;
  const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (row.id !== profileId || typeof row.username !== "string" || typeof row.displayName !== "string" ||
    !(row.area === null || typeof row.area === "string") || !Array.isArray(row.sports) ||
    !record || !count(record.wins) || !count(record.losses) || !count(record.draws) || !count(record.matchesPlayed) ||
    record.matchesPlayed !== record.wins + record.losses + record.draws ||
    !row.sports.every((sport: unknown) => {
      if (!sport || typeof sport !== "object") return false;
      const item = sport as Record<string, unknown>;
      return sports.has(item.sport as string) && skills.has(item.selfAssessedSkill as string) &&
        (item.skillRating === null || (typeof item.skillRating === "number" && Number.isSafeInteger(item.skillRating) && item.skillRating > 0));
    })) throw new Error("Invalid opponent profile response");
  return row as unknown as OpponentProfile;
}
