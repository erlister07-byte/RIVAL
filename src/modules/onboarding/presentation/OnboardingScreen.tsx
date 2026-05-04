import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Building2,
  MapPinned,
  Mountain,
  Trees,
  Waves
} from "lucide-react-native";

import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { DEFAULT_LAUNCH_SPORT, SPORT_CONFIGS, isSportEnabled } from "@/config/sports";
import { SkillLevel, SportSlug } from "@/core/types/models";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { Input } from "@/shared/components/Input";
import { SportIcon } from "@/shared/components/SportIcon";
import { Screen } from "@/shared/components/Screen";
import { SectionTitle } from "@/shared/components/SectionTitle";
import { debugLog } from "@/shared/lib/logger";

const AREAS = [
  "Downtown",
  "Kitsilano",
  "Mount Pleasant",
  "East Vancouver",
  "West End",
  "North Vancouver",
  "Burnaby",
  "Richmond"
] as const;

const AREA_ICON_MAP = {
  Downtown: Building2,
  Kitsilano: Waves,
  "Mount Pleasant": Mountain,
  "East Vancouver": Trees,
  "West End": Building2,
  "North Vancouver": Mountain,
  Burnaby: Building2,
  Richmond: MapPinned
} as const;

const SKILL_OPTIONS: SkillLevel[] = ["beginner", "intermediate", "advanced", "competitive"];

type OnboardingSportRowProps = {
  sport: SportSlug;
  label: string;
  meta?: string;
  isSelected: boolean;
  isEnabled: boolean;
  showLiveBadge?: boolean;
  onPress: () => void;
};

function StatusPill({ label, tone }: { label: string; tone: "live" | "muted" }) {
  return (
    <View style={[styles.statusPill, tone === "live" ? styles.statusPillLive : styles.statusPillMuted]}>
      <Text style={[styles.statusPillLabel, tone === "live" ? styles.statusPillLiveLabel : styles.statusPillMutedLabel]}>
        {label}
      </Text>
    </View>
  );
}

function OnboardingSportRow({
  sport,
  label,
  meta,
  isSelected,
  isEnabled,
  showLiveBadge = false,
  onPress
}: OnboardingSportRowProps) {
  return (
    <Pressable
      disabled={!isEnabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sportRow,
        isEnabled ? styles.sportRowEnabled : styles.sportRowDisabled,
        isSelected ? styles.sportRowSelected : null,
        pressed && isEnabled ? styles.sportRowPressed : null
      ]}
    >
      <View style={styles.sportIconSlot}>
        <SportIcon
          sport={sport}
          size={22}
          color={isSelected ? colors.primary : isEnabled ? colors.text : colors.textMuted}
          strokeWidth={1.9}
        />
      </View>

      <View style={styles.sportRowContent}>
        <Text style={[styles.sportRowLabel, isEnabled ? styles.enabledLabel : styles.disabledLabel]}>{label}</Text>
        {meta ? <Text style={[styles.sportRowMeta, !isEnabled ? styles.disabledMeta : null]}>{meta}</Text> : null}
      </View>

      <View style={styles.sportRowTrailing}>
        {!isEnabled ? (
          <StatusPill label="Coming Soon" tone="muted" />
        ) : showLiveBadge ? (
          <StatusPill label="LIVE" tone="live" />
        ) : null}
      </View>
    </Pressable>
  );
}

export function OnboardingScreen() {
  const { completeOnboarding, currentUser } = useAppState();
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [vancouverArea, setVancouverArea] = useState<(typeof AREAS)[number]>(
    (currentUser?.vancouverArea as (typeof AREAS)[number]) ?? "Downtown"
  );
  const [radius, setRadius] = useState(String(currentUser?.challengeRadiusKm ?? 10));
  const [selectedSports, setSelectedSports] = useState<Partial<Record<SportSlug, SkillLevel>>>(
    currentUser?.sports.length
      ? currentUser.sports.reduce<Partial<Record<SportSlug, SkillLevel>>>((accumulator, sport) => {
          accumulator[sport.sport] = sport.skillLevel;
          return accumulator;
        }, {})
      : { [DEFAULT_LAUNCH_SPORT]: "intermediate" }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const areaRows = useMemo(() => {
    const rows: Array<Array<(typeof AREAS)[number]>> = [];

    for (let index = 0; index < AREAS.length; index += 2) {
      rows.push(AREAS.slice(index, index + 2));
    }

    return rows;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    debugLog("[OnboardingScreen] resyncing form from hydrated currentUser", {
      profileId: currentUser.id,
      onboardingCompleted: currentUser.onboardingCompleted,
      displayName: currentUser.displayName,
      sportsCount: currentUser.sports.length
    });

    setDisplayName(currentUser.displayName ?? "");
    setVancouverArea((currentUser.vancouverArea as (typeof AREAS)[number]) ?? "Downtown");
    setRadius(String(currentUser.challengeRadiusKm ?? 10));
    setSelectedSports(
      currentUser.sports.length
        ? currentUser.sports.reduce<Partial<Record<SportSlug, SkillLevel>>>((accumulator, sport) => {
            accumulator[sport.sport] = sport.skillLevel;
            return accumulator;
          }, {})
        : { [DEFAULT_LAUNCH_SPORT]: "intermediate" }
    );
  }, [currentUser]);

  function toggleSport(sport: SportSlug) {
    setSelectedSports((previous) => {
      if (previous[sport]) {
        const next = { ...previous };
        delete next[sport];
        return next;
      }

      return { ...previous, [sport]: "beginner" };
    });
  }

  async function handleSubmit() {
    const normalizedDisplayName = displayName.trim();
    const normalizedRadius = Number(radius);

    if (!normalizedDisplayName) {
      setError("Username is required.");
      return;
    }

    if (normalizedDisplayName.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    const sports = Object.entries(selectedSports)
      .filter((entry): entry is [SportSlug, SkillLevel] => Boolean(entry[1]))
      .map(([sport, skillLevel]) => ({
        sport,
        skillLevel
      }));

    if (sports.length === 0) {
      setError("Choose at least one sport.");
      return;
    }

    if (!Number.isFinite(normalizedRadius) || normalizedRadius < 1 || normalizedRadius > 100) {
      setError("Challenge radius must be between 1 and 100 km.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await completeOnboarding({
        displayName: normalizedDisplayName,
        vancouverArea,
        challengeRadiusKm: normalizedRadius,
        sports
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error && submissionError.message
          ? submissionError.message
          : "Unable to save onboarding right now."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.heroBlock}>
        <SectionTitle
          eyebrow="Setup"
          title="Build your athlete profile"
          subtitle="Live in Vancouver! Choose your sport and area!"
        />
      </View>

      <View style={styles.fieldBlock}>
        <Input label="Username" value={displayName} onChangeText={setDisplayName} placeholder="Your username" />
      </View>

      <Card style={styles.sectionCard}>
        <Text style={styles.label}>Neighbourhood</Text>
        <View style={styles.neighbourhoodGrid}>
          {areaRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.neighbourhoodRow}>
              {row.map((area) => {
                const Icon = AREA_ICON_MAP[area];

                return (
                  <Pressable
                    key={area}
                    onPress={() => setVancouverArea(area)}
                    style={({ pressed }) => [
                      styles.neighbourhoodTile,
                      vancouverArea === area ? styles.neighbourhoodTileSelected : null,
                      pressed ? styles.neighbourhoodTilePressed : null
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBadge,
                        vancouverArea === area ? styles.iconBadgeSelected : null
                      ]}
                    >
                      <Icon
                        size={20}
                        color={vancouverArea === area ? colors.primary : colors.text}
                        strokeWidth={2.1}
                      />
                    </View>
                    <Text
                      style={[
                        styles.neighbourhoodLabel,
                        vancouverArea === area ? styles.neighbourhoodLabelSelected : null
                      ]}
                    >
                      {area}
                    </Text>
                  </Pressable>
                );
              })}
              {row.length === 1 ? <View style={styles.neighbourhoodSpacer} /> : null}
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.label}>Sports</Text>
        <Text style={styles.helperText}>Pickleball is live! More sports coming soon!</Text>
        <View style={styles.sportList}>
          {SPORT_CONFIGS.map((sport) => (
            <OnboardingSportRow
              key={sport.slug}
              sport={sport.slug}
              label={sport.displayName}
              meta={sport.cityAvailability}
              isSelected={Boolean(selectedSports[sport.slug])}
              isEnabled={sport.enabled}
              showLiveBadge={sport.enabled}
              onPress={() => toggleSport(sport.slug)}
            />
          ))}
        </View>
        {SPORT_CONFIGS.filter((sport) => selectedSports[sport.slug] && isSportEnabled(sport.slug)).map((sport) => (
          <View key={sport.slug} style={styles.skillRow}>
            <Text style={styles.skillTitle}>{sport.displayName} skill</Text>
            <View style={styles.wrap}>
              {SKILL_OPTIONS.map((skill) => (
                <Chip
                  key={`${sport.slug}-${skill}`}
                  label={skill}
                  selected={selectedSports[sport.slug] === skill}
                  onPress={() =>
                    setSelectedSports((previous) => ({ ...previous, [sport.slug]: skill }))
                  }
                />
              ))}
            </View>
          </View>
        ))}
      </Card>

      <View style={styles.fieldBlock}>
        <Input
          label="Challenge Radius (km)"
          value={radius}
          onChangeText={setRadius}
          placeholder="10"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttonBlock}>
        <Button label="Finish Onboarding" onPress={handleSubmit} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs
  },
  fieldBlock: {
    paddingTop: spacing.xxs
  },
  sectionCard: {
    paddingVertical: 24,
    gap: 14
  },
  label: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: typography.overline,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 21,
    marginBottom: 14,
    maxWidth: 320
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  neighbourhoodGrid: {
    gap: 6
  },
  neighbourhoodRow: {
    flexDirection: "row",
    gap: 6
  },
  neighbourhoodTile: {
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    backgroundColor: colors.surface
  },
  neighbourhoodTileSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(91, 33, 182, 0.07)",
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5
    },
    elevation: 2
  },
  neighbourhoodTilePressed: {
    opacity: 0.92
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.04)"
  },
  iconBadgeSelected: {
    backgroundColor: "rgba(91, 33, 182, 0.09)"
  },
  iconBadgeDisabled: {
    backgroundColor: "rgba(15, 23, 42, 0.03)"
  },
  sportIconSlot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  neighbourhoodLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
    minHeight: 36
  },
  neighbourhoodLabelSelected: {
    color: colors.primary
  },
  neighbourhoodSpacer: {
    flex: 1
  },
  sportList: {
    gap: 12
  },
  sportRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    backgroundColor: colors.surface
  },
  sportRowEnabled: {
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3
    },
    elevation: 1
  },
  sportRowSelected: {
    backgroundColor: "rgba(91, 33, 182, 0.055)",
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  },
  sportRowDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: "rgba(15, 23, 42, 0.04)",
    opacity: 0.72
  },
  sportRowPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }]
  },
  sportRowContent: {
    flex: 1,
    gap: 3
  },
  sportRowLabel: {
    fontSize: typography.bodyStrong,
    fontWeight: "700",
    letterSpacing: -0.1
  },
  sportRowMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17
  },
  sportRowTrailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 90
  },
  statusPill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  statusPillLive: {
    backgroundColor: "#F0FDF4",
    borderColor: "rgba(34, 197, 94, 0.14)"
  },
  statusPillMuted: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderColor: "rgba(15, 23, 42, 0.05)"
  },
  statusPillLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.35
  },
  statusPillLiveLabel: {
    color: "#15803D"
  },
  statusPillMutedLabel: {
    color: colors.textMuted
  },
  skillRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.06)"
  },
  skillTitle: {
    fontWeight: "600",
    color: colors.text
  },
  error: {
    color: colors.danger,
    marginTop: spacing.xxs
  },
  enabledLabel: {
    color: colors.text
  },
  disabledLabel: {
    color: colors.textMuted
  },
  disabledMeta: {
    color: colors.gray400
  },
  buttonBlock: {
    paddingTop: spacing.xs
  }
});
