import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { DEFAULT_LAUNCH_SPORT, SPORT_CONFIGS, isSportEnabled } from "@/config/sports";
import { SkillLevel, SportSlug } from "@/core/types/models";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { Input } from "@/shared/components/Input";
import { SportSelectionRow } from "@/shared/components/SportSelectionRow";
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

const SKILL_OPTIONS: SkillLevel[] = ["beginner", "intermediate", "advanced", "competitive"];

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
      setError("Display name is required.");
      return;
    }

    if (normalizedDisplayName.length < 2) {
      setError("Display name must be at least 2 characters.");
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
      <SectionTitle
        eyebrow="Setup"
        title="Build your athlete profile"
        subtitle="Vancouver only for now. Pick your area, sports, and challenge radius."
      />

      <Input label="Display Name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" />

      <Card>
        <Text style={styles.label}>Vancouver Area</Text>
        <View style={styles.wrap}>
          {AREAS.map((area) => (
            <Chip
              key={area}
              label={area}
              selected={vancouverArea === area}
              onPress={() => setVancouverArea(area)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>Sports</Text>
        <Text style={styles.helperText}>Pickleball is live now. The rest of the lineup is coming soon.</Text>
        <View style={styles.sportList}>
          {SPORT_CONFIGS.map((sport) => (
            <SportSelectionRow
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

      <Input
        label="Challenge Radius (km)"
        value={radius}
        onChangeText={setRadius}
        placeholder="10"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Finish Onboarding" onPress={handleSubmit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  helperText: {
    color: colors.textMuted
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  sportList: {
    gap: spacing.sm
  },
  skillRow: {
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  skillTitle: {
    fontWeight: "700",
    color: colors.text
  },
  error: {
    color: colors.danger
  }
});
