import { SportSlug } from "@/core/types/models";

export type SportIconName = "paddle" | "racket" | "golf" | "volleyball" | "basketball" | "running";

export type SportConfig = {
  id: number;
  slug: SportSlug;
  displayName: string;
  enabled: boolean;
  comingSoon: boolean;
  icon: SportIconName;
  cityAvailability?: string;
};

export const SPORT_CONFIGS: SportConfig[] = [
  {
    id: 3,
    slug: "pickleball",
    displayName: "Pickleball",
    enabled: true,
    comingSoon: false,
    icon: "paddle",
    cityAvailability: "Live in Vancouver"
  },
  {
    id: 4,
    slug: "golf",
    displayName: "Golf",
    enabled: false,
    comingSoon: true,
    icon: "golf",
    cityAvailability: "Not live in Vancouver yet"
  },
  {
    id: 1,
    slug: "tennis",
    displayName: "Tennis",
    enabled: false,
    comingSoon: true,
    icon: "racket",
    cityAvailability: "Not live in Vancouver yet"
  },
  {
    id: 5,
    slug: "volleyball",
    displayName: "Volleyball",
    enabled: false,
    comingSoon: true,
    icon: "volleyball",
    cityAvailability: "Not live in Vancouver yet"
  },
  {
    id: 2,
    slug: "basketball",
    displayName: "Basketball",
    enabled: false,
    comingSoon: true,
    icon: "basketball",
    cityAvailability: "Not live in Vancouver yet"
  },
  {
    id: 6,
    slug: "running",
    displayName: "Running",
    enabled: false,
    comingSoon: true,
    icon: "running",
    cityAvailability: "Not live in Vancouver yet"
  }
];

export const SPORT_CONFIG_BY_SLUG = Object.fromEntries(
  SPORT_CONFIGS.map((sport) => [sport.slug, sport] as const)
) as Record<SportSlug, SportConfig>;

export const SPORT_CONFIG_BY_ID = Object.fromEntries(
  SPORT_CONFIGS.map((sport) => [sport.id, sport] as const)
) as Record<number, SportConfig>;

export const ENABLED_SPORT_CONFIGS = SPORT_CONFIGS.filter((sport) => sport.enabled);
export const DISABLED_SPORT_CONFIGS = SPORT_CONFIGS.filter((sport) => !sport.enabled);
export const ENABLED_SPORT_SLUGS = ENABLED_SPORT_CONFIGS.map((sport) => sport.slug);
export const DEFAULT_LAUNCH_SPORT = ENABLED_SPORT_CONFIGS[0]?.slug ?? "pickleball";

export function getSportConfig(slug: SportSlug) {
  return SPORT_CONFIG_BY_SLUG[slug];
}

export function getSportConfigById(id: number) {
  return SPORT_CONFIG_BY_ID[id];
}

export function getSportIdBySlug(slug: SportSlug) {
  return SPORT_CONFIG_BY_SLUG[slug]?.id;
}

export function isSportEnabled(slug: SportSlug) {
  return Boolean(SPORT_CONFIG_BY_SLUG[slug]?.enabled);
}

export function getEnabledSportConfigs() {
  return ENABLED_SPORT_CONFIGS;
}

export function getDisabledSportConfigs() {
  return DISABLED_SPORT_CONFIGS;
}
