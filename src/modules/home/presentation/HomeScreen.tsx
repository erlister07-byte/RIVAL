import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Clock3, Swords, Users } from "lucide-react-native";

import { AppStackParamList, MainTabParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { DEFAULT_LAUNCH_SPORT, getSportIdBySlug } from "@/config/sports";
import { getStakeOutcomeCopy } from "@/core/types/models";
import { isActionableResultMatch, subscribeToMatchActivity } from "@/services/matchService";
import { SuggestedOpponent, getSuggestedOpponents } from "@/services/playerService";
import { subscribeToChallengeActivity } from "@/services/challengeService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { PlayerListItem } from "@/shared/components/PlayerListItem";
import { Screen } from "@/shared/components/Screen";
import { openBetaFeedbackEmail } from "@/shared/lib/betaFeedback";
import { formatDateTime } from "@/shared/lib/format";
import { debugError } from "@/shared/lib/logger";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<AppStackParamList>
>;

function getReadableSkillMatchLabel(skillLevel?: string) {
  switch (skillLevel) {
    case "beginner":
      return "Beginner match";
    case "intermediate":
      return "Intermediate match";
    case "advanced":
      return "Advanced match";
    case "competitive":
      return "Competitive match";
    default:
      return "Good skill match";
  }
}

export function HomeScreen({ navigation }: Props) {
  const { currentUser, challenges, matches, recentMatches, refreshHomeData } = useAppState();
  const isFocused = useIsFocused();
  const [suggestedMatches, setSuggestedMatches] = useState<SuggestedOpponent[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestionsReloadKey, setSuggestionsReloadKey] = useState(0);

  const activeSport =
    currentUser?.sports.find((sport) => sport.sport === DEFAULT_LAUNCH_SPORT) ??
    currentUser?.sports[0];
  const pendingInbox = challenges.filter(
    (challenge) => challenge.opponentProfileId === currentUser?.id && challenge.status === "pending"
  ).length;
  const pendingOutgoing = challenges.filter(
    (challenge) => challenge.challengerProfileId === currentUser?.id && challenge.status === "pending"
  ).length;
  const resultActions = matches.filter((match) => isActionableResultMatch(match, currentUser?.id));
  const defaultPlayTiming = currentUser?.availabilityStatus === "unavailable" ? "today" : currentUser?.availabilityStatus ?? "today";
  const latestConfirmedResult = recentMatches[0];

  useEffect(() => {
    if (!currentUser?.id || !isFocused) {
      return;
    }

    void refreshHomeData().catch((error) => {
      debugError("[HomeScreen] failed to refresh home data on focus", error, {
        profileId: currentUser.id
      });
    });
  }, [currentUser?.availabilityStatus, currentUser?.id, isFocused]);

  useEffect(() => {
    let isActive = true;

    async function loadSuggestedMatches() {
      if (!currentUser?.id || !isFocused) {
        if (isActive) {
          setSuggestedMatches([]);
          if (!currentUser?.id) {
            setLoadingSuggestions(false);
          }
        }
        return;
      }

      setLoadingSuggestions(true);
      setSuggestionsError("");

      try {
        const nextSuggestions = await getSuggestedOpponents(currentUser.id);

        if (isActive) {
          setSuggestedMatches(nextSuggestions);
        }
      } catch (error) {
        if (isActive) {
          setSuggestedMatches([]);
          setSuggestionsError(
            error instanceof Error && error.message
              ? error.message
              : "Unable to load suggested opponents right now."
          );
        }
      } finally {
        if (isActive) {
          setLoadingSuggestions(false);
        }
      }
    }

    void loadSuggestedMatches();

    return () => {
      isActive = false;
    };
  }, [currentUser?.availabilityStatus, currentUser?.id, isFocused, suggestionsReloadKey]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const refreshDashboard = () => {
      if (!isFocused) {
        return;
      }

      void refreshHomeData().catch((error) => {
        debugError("[HomeScreen] failed to refresh home data from realtime", error, {
          profileId: currentUser.id
        });
      });
      setSuggestionsReloadKey((value) => value + 1);
    };

    const challengeChannel = subscribeToChallengeActivity(currentUser.id, refreshDashboard);
    const matchChannel = subscribeToMatchActivity(currentUser.id, refreshDashboard);

    return () => {
      void challengeChannel.unsubscribe();
      void matchChannel.unsubscribe();
    };
  }, [currentUser?.id, isFocused, refreshHomeData]);

  const actionSummary = useMemo(() => {
    if (resultActions.length > 0) {
      return `${resultActions.length} ${resultActions.length === 1 ? "match needs" : "matches need"} a result action.`;
    }

    if (pendingInbox > 0) {
      return `${pendingInbox} ${pendingInbox === 1 ? "challenge is" : "challenges are"} waiting for your response.`;
    }

    if (pendingOutgoing > 0) {
      return `${pendingOutgoing} ${pendingOutgoing === 1 ? "challenge is" : "challenges are"} still waiting on an opponent.`;
    }

    return "You are clear. Start a new match while your board is empty.";
  }, [pendingInbox, pendingOutgoing, resultActions.length]);

  return (
    <Screen>
      <Card>
        <Text style={styles.kicker}>Get In The Game</Text>
        <Text style={styles.heroTitle}>Quick Match!</Text>
        <Text style={styles.heroSubtitle}>
          Find a rival. Play now.
        </Text>

        <Button
          label="Play Now"
          onPress={() =>
            navigation.navigate("NearbyPlayers", {
              mode: "play_now",
              sport: activeSport?.sport ?? DEFAULT_LAUNCH_SPORT,
              availability: defaultPlayTiming
            })
          }
        />
      </Card>

      <Card style={styles.recordCard}>
        <Text style={styles.kicker}>Your Record</Text>
        <Text style={styles.recordText}>
          {currentUser?.wins ?? 0}-{currentUser?.losses ?? 0} • {currentUser?.matchesPlayed ?? 0}{" "}
          {currentUser?.matchesPlayed === 1 ? "match played" : "matches played"}
        </Text>
      </Card>

      {latestConfirmedResult ? (
        <Card style={styles.recentResultCard}>
          <Text style={styles.kicker}>Latest Result</Text>
          <Text style={styles.recentResultTitle}>
            {latestConfirmedResult.result === "win" ? "You beat" : "You lost to"} {latestConfirmedResult.opponentName} —{" "}
            {getStakeOutcomeCopy({
              result: latestConfirmedResult.result,
              stakeType: latestConfirmedResult.stakeType,
              stakeLabel: latestConfirmedResult.stakeLabel
            })}
          </Text>
          <Text style={styles.recentResultMeta}>
            {latestConfirmedResult.sport} · {latestConfirmedResult.scoreSummary} · {formatDateTime(latestConfirmedResult.date)}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.kicker}>Start A Rivalry</Text>
        <Text style={styles.cardTitle}>Create a challenge</Text>
        <Text style={styles.cardText}>Find a rival. Choose the stakes.</Text>

        <View style={styles.createActions}>
          <Button label="Challenge a Friend" onPress={() => navigation.navigate("FriendSearch")} />
          <Button
            label="Create an Open Challenge"
            tone="secondary"
            onPress={() => navigation.navigate("CreateChallenge", { mode: "open" })}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.kicker}>Needs Your Attention</Text>
        <Text style={styles.cardTitle}>Keep the board moving</Text>
        <Text style={styles.cardText}>{actionSummary}</Text>

        <View style={styles.queueGrid}>
          <View style={styles.queueTile}>
            <Clock3 size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.queueValue}>{pendingInbox}</Text>
            <Text style={styles.queueLabel}>Incoming</Text>
          </View>
          <View style={styles.queueTile}>
            <Swords size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.queueValue}>{resultActions.length}</Text>
            <Text style={styles.queueLabel}>Results</Text>
          </View>
          <View style={styles.queueTile}>
            <Users size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.queueValue}>{pendingOutgoing}</Text>
            <Text style={styles.queueLabel}>Sent</Text>
          </View>
        </View>

        {resultActions.length > 0 ? (
          <Button label="Open Match Results" onPress={() => navigation.navigate("ResultsInbox")} />
        ) : (
          <Button label="Open Challenge Inbox" onPress={() => navigation.navigate("ChallengeInbox")} />
        )}
      </Card>

      <Card>
        <Text style={styles.kicker}>Find Your Next Rival</Text>
        <Text style={styles.cardTitle}>Competitive players near you</Text>
        <Text style={styles.cardText}>
          Players near you matching your sport, availability, and level.
        </Text>

        {loadingSuggestions ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Finding fair opponents...</Text>
          </View>
        ) : suggestionsError ? (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{suggestionsError}</Text>
            <Button label="Try Again" tone="secondary" onPress={() => setSuggestionsReloadKey((value) => value + 1)} />
          </View>
        ) : suggestedMatches.length === 0 ? (
          <EmptyState
            title="No rivals nearby yet"
            description="Check back soon."
          />
        ) : (
          <View style={styles.listWrap}>
            {suggestedMatches.slice(0, 3).map((player) => (
              <PlayerListItem
                key={player.id}
                profileId={player.id}
                username={player.username}
                decisionText={`${getReadableSkillMatchLabel(player.matchedSkillLevel)} · ${player.matchesPlayed} ${player.matchesPlayed === 1 ? "match played" : "matches played"}`}
                secondaryTextOverride={player.matchedSport}
                playStyleTags={player.playStyleTags}
                actionLabel="Challenge"
                onPress={() =>
                  navigation.navigate("CreateChallenge", {
                    opponentId: player.id,
                    opponentUsername: player.username,
                    sportId: player.sportId,
                    timingContext: defaultPlayTiming
                  })
                }
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.kicker}>Rematch</Text>
        <Text style={styles.cardTitle}>Rematch!</Text>
        <Text style={styles.cardText}>Keep the rivalry going.</Text>
        <Text style={styles.trustCue}>Verified results</Text>

        {recentMatches.length === 0 ? (
          <EmptyState
            title="No rematches yet"
            description="Finish a match to unlock rematches."
          />
        ) : (
          <View style={styles.listWrap}>
            {recentMatches.slice(0, 2).map((match) => (
              <PlayerListItem
                key={match.id}
                profileId={match.opponentProfileId}
                username={match.opponentName}
                displayName={match.opponentName}
                sportLabel={match.sport}
                reason={`${match.result === "win" ? "You won last time" : "They won last time"} · ${match.scoreSummary}`}
                actionLabel="Rematch"
                onPress={() =>
                  navigation.navigate("CreateChallenge", {
                    opponentId: match.opponentProfileId,
                    opponentName: match.opponentName,
                    sportId: getSportIdBySlug(match.sport),
                    isRematch: true,
                    timingContext: defaultPlayTiming
                  })
                }
              />
            ))}
          </View>
        )}
      </Card>

      <Card style={styles.footerCard}>
        <Text style={styles.kicker}>Beta Tools</Text>
        <Text style={styles.footerText}>Need help or want to sanity-check rankings while the beta grows?</Text>
        <View style={styles.footerActions}>
          <Button label="Leaderboard" tone="secondary" onPress={() => navigation.navigate("Leaderboard")} />
          <Button
            label="Report Beta Issue"
            tone="secondary"
            onPress={() =>
              void openBetaFeedbackEmail({
                screen: "Home",
                profileId: currentUser?.id ?? null,
                extra: {
                  pendingChallenges: pendingInbox,
                  pendingResults: resultActions.length
                }
              })
            }
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontSize: typography.overline
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    marginTop: -2
  },
  heroSubtitle: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: -1
  },
  recordCard: {
    gap: spacing.xxs
  },
  recordText: {
    color: colors.text,
    fontSize: typography.bodyStrong,
    fontWeight: "700"
  },
  recentResultCard: {
    gap: spacing.xs
  },
  recentResultTitle: {
    color: colors.text,
    fontSize: typography.bodyStrong,
    fontWeight: "800",
    lineHeight: 22
  },
  recentResultMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "800",
    marginTop: -1
  },
  cardText: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: -1
  },
  trustCue: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
    marginTop: 0
  },
  createActions: {
    gap: spacing.xs,
    marginTop: 0
  },
  queueGrid: {
    flexDirection: "row",
    gap: spacing.xs
  },
  queueTile: {
    flex: 1,
    gap: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 14
  },
  queueValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  queueLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  stateContainer: {
    gap: spacing.xs,
    alignItems: "center"
  },
  stateText: {
    color: colors.textMuted
  },
  errorText: {
    color: colors.error,
    textAlign: "center"
  },
  listWrap: {
    gap: spacing.sm,
    marginTop: 0
  },
  footerCard: {
    gap: spacing.xs
  },
  footerText: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: -2
  },
  footerActions: {
    gap: spacing.xs,
    marginTop: 0
  }
});
