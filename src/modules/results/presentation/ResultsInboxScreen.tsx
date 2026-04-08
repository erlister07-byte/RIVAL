import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/application/providers/AppProvider";
import { AppStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { getChallengeTypeLabel, getStakeDisplay } from "@/core/types/models";
import { Badge } from "@/components/ui/Badge";
import { getPlayerById } from "@/services/userService";
import {
  formatResultConfirmationDeadline,
  getMatchesForProfile,
  isActionableResultMatch,
  subscribeToMatchActivity
} from "@/services/matchService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";
import { openBetaFeedbackEmail } from "@/shared/lib/betaFeedback";
import { formatDateTime } from "@/shared/lib/format";
import { debugError, debugLog } from "@/shared/lib/logger";

type Props = NativeStackScreenProps<AppStackParamList, "ResultsInbox">;

export function ResultsInboxScreen({ navigation }: Props) {
  const { currentUser, matches, challenges } = useAppState();
  const isFocused = useIsFocused();
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});
  const [liveMatches, setLiveMatches] = useState(matches);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingNames, setLoadingNames] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLiveMatches(matches);
  }, [matches]);

  useEffect(() => {
    let isActive = true;

    async function refreshMatches() {
      if (!currentUser?.id || !isFocused) {
        return;
      }

      setLoadingMatches(true);
      debugLog("[ResultsInboxScreen] refreshing matches on focus", {
        profileId: currentUser.id
      });

      try {
        const nextMatches = await getMatchesForProfile(currentUser.id);

        if (!isActive) {
          return;
        }

        debugLog("[ResultsInboxScreen] refreshed matches on focus", {
          profileId: currentUser.id,
          totalMatches: nextMatches.length
        });
        setLiveMatches(nextMatches);
        setRefreshError("");
      } catch (error) {
        debugError("[ResultsInboxScreen] failed to refresh matches", error, {
          profileId: currentUser?.id
        });
        setRefreshError("Live match updates are delayed. Try refreshing this screen.");
      } finally {
        if (isActive) {
          setLoadingMatches(false);
        }
      }
    }

    void refreshMatches();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, isFocused, reloadKey]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const realtimeChannel = subscribeToMatchActivity(currentUser.id, () => {
      if (!isFocused) {
        return;
      }

      setLoadingMatches(true);
      void getMatchesForProfile(currentUser.id)
        .then((nextMatches) => {
          setLiveMatches(nextMatches);
          setRefreshError("");
        })
        .catch((error) => {
          debugError("[ResultsInboxScreen] failed to refresh matches from realtime", error, {
            profileId: currentUser.id
          });
          setRefreshError("Live match updates are delayed. Try refreshing this screen.");
        })
        .finally(() => {
          setLoadingMatches(false);
        });
    });

    return () => {
      void realtimeChannel.unsubscribe();
    };
  }, [currentUser?.id, isFocused]);

  const actionableMatches = useMemo(
    () =>
      currentUser
        ? liveMatches
        .filter((match) => isActionableResultMatch(match, currentUser.id))
        .map((match) => {
          const linkedChallenge = challenges.find((challenge) => challenge.id === match.challengeId);
          const isChallenger = match.challengerProfileId === currentUser.id;
          const opponentId = isChallenger ? match.opponentProfileId : match.challengerProfileId;
          const actionNeeded =
            match.resultStatus === "pending_confirmation" ? "Confirm result" : "Submit result";

          return {
            match,
            challenge: linkedChallenge,
            opponentId,
            actionNeeded
          };
        })
        : [],
    [challenges, currentUser, liveMatches]
  );

  useEffect(() => {
    let isActive = true;

    async function loadOpponentNames() {
      const opponentIds = Array.from(new Set(actionableMatches.map((item) => item.opponentId)));

      if (opponentIds.length === 0) {
        if (isActive) {
          setOpponentNames({});
        }
        return;
      }

      setLoadingNames(true);

      try {
        const players = await Promise.all(opponentIds.map((profileId) => getPlayerById(profileId)));

        if (!isActive) {
          return;
        }

        setOpponentNames(
          players.reduce<Record<string, string>>((accumulator, player, index) => {
            if (player) {
              accumulator[opponentIds[index]] = player.displayName;
            }

            return accumulator;
          }, {})
        );
      } catch (error) {
        debugError("[ResultsInboxScreen] failed to load opponent names", error, {
          opponentIds
        });

        if (isActive) {
          setOpponentNames({});
        }
      } finally {
        if (isActive) {
          setLoadingNames(false);
        }
      }
    }

    void loadOpponentNames();

    return () => {
      isActive = false;
    };
  }, [actionableMatches]);

  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>Match Results</Text>
        <Text style={styles.helperText}>
          Open a specific match below to submit or confirm the result.
        </Text>
        {refreshError ? <Text style={styles.inlineError}>{refreshError}</Text> : null}
        <Button label="Refresh Matches" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
        <Button
          label="Report Beta Issue"
          tone="secondary"
          onPress={() =>
            void openBetaFeedbackEmail({
              screen: "ResultsInbox",
              profileId: currentUser?.id ?? null,
              status: refreshError || "open",
              extra: {
                actionableMatches: actionableMatches.length
              }
            })
          }
        />
      </Card>

      {loadingMatches || loadingNames ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.helperText}>Loading active matches...</Text>
        </View>
      ) : actionableMatches.length === 0 ? (
        <Card>
          <EmptyState
            title="No match results waiting on you"
            description="Active matches that need a submitted or confirmed result will appear here."
          />
          <Button label="Back to Home" tone="secondary" onPress={() => navigation.navigate("Tabs")} />
        </Card>
      ) : (
        actionableMatches.map(({ match, challenge, opponentId, actionNeeded }) => (
          <Card key={match.id}>
            <View style={styles.rowTop}>
              <View style={styles.rowTitleWrap}>
                <Text style={styles.playerName}>{opponentNames[opponentId] ?? "Opponent"}</Text>
                <Text style={styles.sportMeta}>{match.sport}</Text>
              </View>
              <Badge
                label={actionNeeded}
                tone={match.resultStatus === "pending_confirmation" ? "success" : "default"}
              />
            </View>

            <Text style={styles.meta}>
              {challenge ? getChallengeTypeLabel(challenge.challengeType) : "Match challenge"}
            </Text>
            <Text style={styles.meta}>
              {challenge ? formatDateTime(challenge.scheduledAt) : formatDateTime(match.playedAt)}
            </Text>
            <Text style={styles.meta}>
              {challenge
                ? `${challenge.locationName} · ${getStakeDisplay(challenge.stakeType, challenge.stakeLabel)}`
                : match.locationName}
            </Text>
            <Text style={styles.statusText}>
              Current status: {match.resultStatus}
              {challenge ? ` · Stakes: ${getStakeDisplay(challenge.stakeType, challenge.stakeLabel)}` : ""}
            </Text>
            {match.resultStatus === "pending_confirmation" ? (
              <Text style={styles.deadlineText}>
                Awaiting opponent response · {formatResultConfirmationDeadline(match.resultConfirmationDeadlineAt)}
              </Text>
            ) : null}

            <Button
              label={match.resultStatus === "pending_confirmation" ? "Confirm Match Result" : "Record Match Result"}
              onPress={() =>
                navigation.navigate(
                  match.resultStatus === "pending_confirmation" ? "ConfirmResult" : "MatchResultSubmission",
                  { matchId: match.id }
                )
              }
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.heading
  },
  helperText: {
    color: colors.textMuted,
    lineHeight: 22
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md
  },
  rowTitleWrap: {
    flex: 1,
    gap: spacing.xs
  },
  playerName: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.subheading
  },
  sportMeta: {
    color: colors.primary,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 21
  },
  statusText: {
    color: colors.text,
    fontWeight: "600"
  },
  deadlineText: {
    color: colors.textMuted,
    lineHeight: 20
  },
  inlineError: {
    color: colors.danger,
    lineHeight: 20
  }
});
