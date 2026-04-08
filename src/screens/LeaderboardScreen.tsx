import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { colors, radius, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { LeaderboardEntry } from "@/core/types/models";
import { getAvailableLeaderboardSports, getLeaderboardBySport } from "@/services/leaderboardService";
import { Database } from "@/types/database";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "Leaderboard">;
type SportRow = Database["public"]["Tables"]["sports"]["Row"];

export function LeaderboardScreen({ navigation }: Props) {
  const { currentUser } = useAppState();
  const [sports, setSports] = useState<SportRow[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loadingSports, setLoadingSports] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadSports() {
      setLoadingSports(true);
      setError("");

      try {
        const nextSports = await getAvailableLeaderboardSports();

        if (!isActive) {
          return;
        }

        setSports(nextSports);
        setSelectedSportId((current) => current || String(nextSports[0]?.id ?? ""));
      } catch (loadError) {
        if (isActive) {
          setSports([]);
          setError(
            loadError instanceof Error && loadError.message
              ? loadError.message
              : "Unable to load sports right now."
          );
        }
      } finally {
        if (isActive) {
          setLoadingSports(false);
        }
      }
    }

    void loadSports();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadLeaderboard() {
      if (!currentUser?.id || !selectedSportId) {
        if (isActive) {
          setLeaderboard([]);
          setCurrentUserEntry(null);
          setLoadingLeaderboard(false);
        }
        return;
      }

      setLoadingLeaderboard(true);
      setError("");

      try {
        const result = await getLeaderboardBySport(selectedSportId, currentUser.id);

        if (!isActive) {
          return;
        }

        setLeaderboard(result.leaderboard);
        setCurrentUserEntry(result.currentUserEntry);
      } catch (loadError) {
        if (isActive) {
          setLeaderboard([]);
          setCurrentUserEntry(null);
          setError(
            loadError instanceof Error && loadError.message
              ? loadError.message
              : "Unable to load leaderboard right now."
          );
        }
      } finally {
        if (isActive) {
          setLoadingLeaderboard(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, selectedSportId]);

  function renderRow({ item }: { item: LeaderboardEntry }) {
    return (
      <View style={styles.row}>
        <Text style={styles.rank}>{item.rank}</Text>
        <View style={styles.rowContent}>
          <Text style={styles.name}>{item.display_name}</Text>
          <Text style={styles.meta}>{item.matches_played} matches played</Text>
        </View>
      </View>
    );
  }

  return (
    <Screen scrollable={false}>
      <Card>
        <Text style={styles.selectorLabel}>Sport</Text>
        <Text style={styles.selectorHelp}>Rankings are based on confirmed matches played.</Text>
        <View style={styles.selectorWrap}>
          {sports.map((sport) => (
            <Chip
              key={sport.id}
              label={sport.name}
              selected={selectedSportId === String(sport.id)}
              onPress={() => setSelectedSportId(String(sport.id))}
            />
          ))}
        </View>
      </Card>

      {currentUserEntry ? (
        <Card>
          <Text style={styles.sectionTitle}>Your Rank</Text>
          <View style={styles.yourRankRow}>
            <Text style={styles.rank}>#{currentUserEntry.rank}</Text>
            <View style={styles.rowContent}>
              <Text style={styles.name}>{currentUserEntry.display_name}</Text>
              <Text style={styles.meta}>{currentUserEntry.matches_played} matches played</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {loadingSports || loadingLeaderboard ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading leaderboard...</Text>
        </View>
      ) : error ? (
        <Card>
          <Text style={styles.errorTitle}>Could not load leaderboard</Text>
          <Text style={styles.stateText}>{error}</Text>
        </Card>
      ) : leaderboard.length === 0 ? (
        <Card>
          <EmptyState
            title="No one is on the board yet"
            description="Play your first confirmed match to get this pickleball leaderboard started."
          />
          <Button label="Challenge a Player" onPress={() => navigation.navigate("CreateChallenge")} />
        </Card>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.profile_id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectorLabel: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  selectorHelp: {
    color: colors.textMuted
  },
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  sectionTitle: {
    fontWeight: "700",
    color: colors.text,
    fontSize: typography.subheading
  },
  yourRankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  rank: {
    width: 42,
    color: colors.text,
    fontWeight: "800",
    fontSize: 20
  },
  rowContent: {
    flex: 1,
    gap: spacing.xs
  },
  name: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
  },
  meta: {
    color: colors.textMuted
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  stateText: {
    color: colors.textMuted,
    textAlign: "center"
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: typography.subheading
  }
});
