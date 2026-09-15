import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { getStakeOutcomeCopy, Profile } from "@/core/types/models";
import {
  MatchForSubmission,
  formatResultConfirmationDeadline,
  getMatchForConfirmation,
  subscribeToMatchActivity
} from "@/services/matchService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { ResolvedStateCard } from "@/shared/components/ResolvedStateCard";
import { StatPill } from "@/shared/components/StatPill";
import { SuccessBanner } from "@/shared/components/SuccessBanner";
import { openBetaFeedbackEmail } from "@/shared/lib/betaFeedback";
import { getLevelProgress } from "@/shared/lib/levels";
import { debugError, debugLog } from "@/shared/lib/logger";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";
import { useTimedSuccess } from "@/shared/lib/useTimedSuccess";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "ConfirmResult">;

export function ConfirmResultScreen({ navigation, route }: Props) {
  const { currentUser, confirmResult, rejectResult } = useAppState();
  const isFocused = useIsFocused();
  const [match, setMatch] = useState<MatchForSubmission | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [resolvedState, setResolvedState] = useState<"confirmed" | "rejected" | null>(null);
  const [confirmedProgression, setConfirmedProgression] = useState<
    Pick<Profile, "wins" | "losses" | "draws" | "matchesPlayed" | "xp"> | null
  >(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { success, showSuccess, clearSuccess } = useTimedSuccess();

  useEffect(() => {
    let isActive = true;

    async function loadMatch() {
      if (!isFocused) {
        return;
      }

      debugLog("[ConfirmResultScreen] loading match", {
        matchId: route.params.matchId,
        currentUserId: currentUser?.id ?? null,
        reloadKey
      });

      setLoadingMatch(true);
      setError("");

      try {
        const nextMatch = await getMatchForConfirmation(route.params.matchId);
        if (isActive) {
          setMatch(nextMatch);
        }
      } catch (loadError) {
        if (isActive) {
          debugError("[ConfirmResultScreen] failed to load match", loadError, {
            matchId: route.params.matchId,
            currentUserId: currentUser?.id ?? null,
            reloadKey
          });
          setError(getUserSafeErrorMessage(loadError, "Unable to load result details."));
          clearSuccess();
        }
      } finally {
        if (isActive) {
          setLoadingMatch(false);
        }
      }
    }

    void loadMatch();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, isFocused, reloadKey, route.params.matchId]);

  useEffect(() => {
    if (!isFocused) {
      clearSuccess();
      setResolvedState(null);
      setConfirmedProgression(null);
    }
  }, [clearSuccess, isFocused]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const realtimeChannel = subscribeToMatchActivity(currentUser.id, () => {
      if (!isFocused || actionLoading) {
        return;
      }

      setLoadingMatch(true);
      void getMatchForConfirmation(route.params.matchId)
        .then((nextMatch) => {
          setMatch(nextMatch);
        })
        .catch((loadError) => {
          setError(getUserSafeErrorMessage(loadError, "Unable to load result details."));
        })
        .finally(() => {
          setLoadingMatch(false);
        });
    });

    return () => {
      void realtimeChannel.unsubscribe();
    };
  }, [actionLoading, currentUser?.id, isFocused, route.params.matchId]);

  if (loadingMatch) {
    return (
      <Screen>
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading submitted result...</Text>
        </View>
      </Screen>
    );
  }

  if (!match || !currentUser) {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="No result found"
            description={error || "There is no pending match result waiting on you right now."}
          />
          <Button label="Try Again" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
        </Card>
      </Screen>
    );
  }

  if (match.resultStatus !== "pending_confirmation" && resolvedState === null) {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="Result not pending"
            description="This match result is no longer waiting for confirmation."
          />
          <Button label="Refresh Match" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
        </Card>
      </Screen>
    );
  }

  if (match.submittedByProfileId === currentUser.id) {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="Waiting on opponent"
            description={`You already submitted this result. The other player can confirm or dispute it. ${formatResultConfirmationDeadline(match.resultConfirmationDeadlineAt)}`}
          />
          <Button label="Refresh Match" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
        </Card>
      </Screen>
    );
  }

  const resolvedMatch = match;
  const resolvedCurrentUser = currentUser;
  const isDraw = resolvedMatch.resultOutcome === "draw";

  const winnerName =
    resolvedMatch.winnerProfileId === resolvedMatch.challengerProfileId
      ? resolvedMatch.challengerName
      : resolvedMatch.opponentName;
  const loserName =
    resolvedMatch.loserProfileId === resolvedMatch.challengerProfileId
      ? resolvedMatch.challengerName
      : resolvedMatch.opponentName;
  const nextOpponentId =
    resolvedCurrentUser.id === resolvedMatch.challengerProfileId
      ? resolvedMatch.opponentProfileId
      : resolvedMatch.challengerProfileId;
  const nextOpponentName =
    resolvedCurrentUser.id === resolvedMatch.challengerProfileId
      ? resolvedMatch.opponentName
      : resolvedMatch.challengerName;
  const confirmedResultDirection = isDraw
    ? "draw"
    : resolvedMatch.winnerProfileId === resolvedCurrentUser.id
      ? "win"
      : "loss";
  const confirmedStakeOutcome = getStakeOutcomeCopy({
    result: confirmedResultDirection,
    stakeType: resolvedMatch.stakeType,
    stakeLabel: resolvedMatch.stakeLabel
  });
  const earnedXp = confirmedResultDirection === "win"
    ? 200
    : confirmedResultDirection === "loss"
      ? 100
      : 150;
  const confirmedLevelProgress = confirmedProgression ? getLevelProgress(confirmedProgression.xp) : null;
  const confirmedResultTitle = confirmedResultDirection === "win"
    ? "Victory"
    : confirmedResultDirection === "draw"
      ? "Draw"
      : "Match complete";
  const confirmedResultCopy = confirmedResultDirection === "win"
    ? `You won against ${nextOpponentName}.`
    : confirmedResultDirection === "draw"
      ? `You drew with ${nextOpponentName}.`
      : `You lost to ${nextOpponentName}.`;

  async function handleConfirm() {
    setActionLoading("confirm");
    setError("");
    clearSuccess();

    try {
      const confirmation = await confirmResult(resolvedMatch.id);
      setConfirmedProgression(confirmation.progression);
      showSuccess(
        confirmedResultDirection === "draw"
          ? "Draw confirmed"
          : confirmedResultDirection === "win"
            ? "Win confirmed"
            : "Loss confirmed",
        confirmedStakeOutcome
      );
      setResolvedState("confirmed");
    } catch (actionError) {
      debugError("[ConfirmResultScreen] confirm result failed", actionError, {
        matchId: resolvedMatch.id,
        currentUserId: resolvedCurrentUser.id
      });
      setError(
        getUserSafeErrorMessage(actionError, "Unable to confirm result.")
      );
      try {
        const nextMatch = await getMatchForConfirmation(route.params.matchId);
        setMatch(nextMatch);
      } catch (reloadError) {
        debugError("[ConfirmResultScreen] failed to refresh stale match after confirm error", reloadError, {
          matchId: route.params.matchId
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (resolvedState === "confirmed") {
    return (
      <Screen>
        {success ? <SuccessBanner title={success.title} hint={success.hint} onDismiss={clearSuccess} /> : null}
        <ResolvedStateCard
          title={confirmedResultTitle}
          description={`Result confirmed. ${confirmedResultCopy} ${confirmedStakeOutcome}`}
        />
        <Card>
          <Text style={styles.rewardLabel}>Match Reward</Text>
          <Text style={styles.rewardValue}>+{earnedXp} XP earned</Text>
          <Text style={styles.helperText}>Reward from this confirmed match.</Text>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>Updated Progression</Text>
          {confirmedProgression && confirmedLevelProgress ? (
            <>
              <View style={styles.progressionSummary}>
                <View style={styles.progressionMetric}>
                  <Text style={styles.progressionLabel}>RIVAL Level</Text>
                  <Text style={styles.progressionValue}>{confirmedLevelProgress.level}</Text>
                </View>
                <View style={styles.progressionMetric}>
                  <Text style={styles.progressionLabel}>Lifetime XP</Text>
                  <Text style={styles.progressionValue}>{confirmedLevelProgress.xp.toLocaleString()} XP</Text>
                </View>
              </View>
              <View style={styles.levelProgressCopy}>
                <Text style={styles.levelProgressLabel}>
                  Progress toward Level {confirmedLevelProgress.level + 1}
                </Text>
                <Text style={styles.levelProgressValue}>
                  {confirmedLevelProgress.xpIntoLevel.toLocaleString()} / {confirmedLevelProgress.xpRequiredForNextLevel.toLocaleString()} XP
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`Progress toward RIVAL Level ${confirmedLevelProgress.level + 1}`}
                accessibilityValue={{
                  min: 0,
                  max: confirmedLevelProgress.xpRequiredForNextLevel,
                  now: confirmedLevelProgress.xpIntoLevel,
                  text: `${confirmedLevelProgress.xpIntoLevel} of ${confirmedLevelProgress.xpRequiredForNextLevel} XP`
                }}
                style={styles.levelProgressTrack}
              >
                <View
                  style={[
                    styles.levelProgressFill,
                    { width: `${confirmedLevelProgress.progressRatio * 100}%` }
                  ]}
                />
              </View>
              <Text style={styles.recordLabel}>Updated Record</Text>
              <View style={styles.statsRow}>
                <StatPill label="Wins" value={confirmedProgression.wins} />
                <StatPill label="Losses" value={confirmedProgression.losses} />
                <StatPill label="Draws" value={confirmedProgression.draws} />
                <StatPill label="Played" value={confirmedProgression.matchesPlayed} />
              </View>
            </>
          ) : (
            <View style={styles.progressionUnavailable}>
              <Text style={styles.progressionUnavailableTitle}>Progress update unavailable</Text>
              <Text style={styles.helperText}>
                Your result is confirmed. Open Profile or Home to refresh your latest record, Lifetime XP, and RIVAL Level.
              </Text>
            </View>
          )}
        </Card>
        <Button
          label="Challenge Again"
          onPress={() =>
            navigation.replace("CreateChallenge", {
              opponentId: nextOpponentId,
              opponentName: nextOpponentName,
              sport: resolvedMatch.sport,
              isRematch: true
            })
          }
        />
        <Button
          label="Find New Player"
          tone="secondary"
          onPress={() => navigation.navigate("NearbyPlayers")}
        />
        <Button label="Back to Home" tone="secondary" onPress={() => navigation.navigate("Tabs")} />
      </Screen>
    );
  }

  async function handleReject() {
    setActionLoading("reject");
    setError("");
    clearSuccess();

    try {
      await rejectResult(resolvedMatch.id);
      showSuccess("Result rejected", "Submit a new result.");
      setResolvedState("rejected");
    } catch (actionError) {
      debugError("[ConfirmResultScreen] reject result failed", actionError, {
        matchId: resolvedMatch.id,
        currentUserId: resolvedCurrentUser.id
      });
      setError(
        getUserSafeErrorMessage(actionError, "Unable to reject result.")
      );
      try {
        const nextMatch = await getMatchForConfirmation(route.params.matchId);
        setMatch(nextMatch);
      } catch (reloadError) {
        debugError("[ConfirmResultScreen] failed to refresh stale match after reject error", reloadError, {
          matchId: route.params.matchId
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (resolvedState === "rejected") {
    return (
      <Screen>
        {success ? <SuccessBanner title={success.title} hint={success.hint} onDismiss={clearSuccess} /> : null}
        <ResolvedStateCard
          title="Result rejected"
          description={isDraw
            ? "This Draw proposal is now disputed. Wait for the match state to change before taking another action here."
            : "This result is now disputed. Wait for the match state to change before taking another action here."}
        />
        <Card>
          <Text style={styles.sectionTitle}>Result Rejected</Text>
          <Text style={styles.helperText}>
            {isDraw
              ? "The submitted Draw proposal was rejected and is no longer ready for confirmation."
              : "The submitted result was rejected and is no longer ready for confirmation."}
          </Text>
          <Text style={styles.successSummary}>
            Next step: coordinate with the other player, then refresh this match when the result state changes.
          </Text>
        </Card>
        <Button label="Refresh Match" onPress={() => setReloadKey((value) => value + 1)} />
        <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
      </Screen>
    );
  }

  return (
    <Screen>
      {success ? <SuccessBanner title={success.title} hint={success.hint} onDismiss={clearSuccess} /> : null}
      <Card>
        <Text style={styles.sectionTitle}>Review Match Result</Text>
        <Text style={styles.helperText}>Confirm this result to finalize the match and update both players' stats.</Text>
        <Text style={styles.deadlineText}>
          Awaiting your response · {formatResultConfirmationDeadline(resolvedMatch.resultConfirmationDeadlineAt)}
        </Text>
        {isDraw ? (
          <>
            <Text style={styles.label}>Result</Text>
            <Text style={styles.value}>Draw</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>Winner</Text>
            <Text style={styles.value}>{winnerName}</Text>
            <Text style={styles.label}>Loser</Text>
            <Text style={styles.value}>{loserName}</Text>
          </>
        )}
        <Text style={styles.label}>Score</Text>
        <Text style={styles.value}>{resolvedMatch.scoreSummary ?? "No score submitted"}</Text>
        <Text style={styles.label}>Notes</Text>
        <Text style={styles.value}>{resolvedMatch.resultNotes ?? "No notes"}</Text>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card>
        <Text style={styles.helperText}>
          If another player has already acted and this screen looks wrong, refresh the match or report a beta issue with the match ref below.
        </Text>
        <Text style={styles.diagnosticText}>Match ref: {resolvedMatch.id}</Text>
        <Text style={styles.diagnosticText}>Current state: {resolvedMatch.resultStatus}</Text>
        <Button label="Refresh Match" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} disabled={Boolean(actionLoading)} />
        <Button
          label="Report Beta Issue"
          tone="secondary"
          onPress={() =>
            void openBetaFeedbackEmail({
              screen: "ConfirmResult",
              profileId: resolvedCurrentUser.id,
              challengeId: resolvedMatch.challengeId,
              matchId: resolvedMatch.id,
              status: resolvedMatch.resultStatus
            })
          }
          disabled={Boolean(actionLoading)}
        />
      </Card>
      <Button
        label={isDraw ? "Confirm Draw & Update Stats" : "Confirm & Update Stats"}
        onPress={handleConfirm}
        loading={actionLoading === "confirm"}
        disabled={Boolean(actionLoading)}
      />
      <Button
        label="Dispute Result"
        tone="secondary"
        onPress={handleReject}
        disabled={Boolean(actionLoading)}
      />
      <Button label="Back" tone="secondary" onPress={() => navigation.goBack()} disabled={Boolean(actionLoading)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.subheading
  },
  label: {
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.overline
  },
  value: {
    color: colors.text,
    fontSize: typography.bodyStrong,
    marginBottom: spacing.xs
  },
  helperText: {
    color: colors.textMuted
  },
  deadlineText: {
    color: colors.textMuted,
    lineHeight: 20
  },
  diagnosticText: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  rewardLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  rewardValue: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: typography.title
  },
  progressionSummary: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted
  },
  progressionMetric: {
    flex: 1,
    gap: spacing.xxs
  },
  progressionLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: typography.caption
  },
  progressionValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: typography.heading
  },
  levelProgressCopy: {
    gap: spacing.xxs
  },
  levelProgressLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: typography.caption
  },
  levelProgressValue: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.bodyStrong
  },
  levelProgressTrack: {
    width: "100%",
    height: 10,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.border
  },
  levelProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  recordLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  progressionUnavailable: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted
  },
  progressionUnavailableTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.bodyStrong
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  stateText: {
    color: colors.textMuted
  },
  error: {
    color: colors.danger,
    fontWeight: "600"
  },
  successSummary: {
    color: colors.textMuted,
    lineHeight: 22
  }
});
