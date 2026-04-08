import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { MatchForSubmission, getMatchForSubmission, subscribeToMatchActivity } from "@/services/matchService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { Input } from "@/shared/components/Input";
import { ResolvedStateCard } from "@/shared/components/ResolvedStateCard";
import { SuccessBanner } from "@/shared/components/SuccessBanner";
import { openBetaFeedbackEmail } from "@/shared/lib/betaFeedback";
import { debugError, debugLog, getSafeErrorPayload } from "@/shared/lib/logger";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";
import { useTimedSuccess } from "@/shared/lib/useTimedSuccess";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "MatchResultSubmission">;

export function MatchResultSubmissionScreen({ navigation, route }: Props) {
  const { currentUser, submitResult } = useAppState();
  const isFocused = useIsFocused();
  const [match, setMatch] = useState<MatchForSubmission | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [winnerId, setWinnerId] = useState(currentUser?.id ?? "");
  const [scoreSummary, setScoreSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { success, showSuccess, clearSuccess } = useTimedSuccess();
  const navigateBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMatch() {
      if (!isFocused) {
        return;
      }

      debugLog("[MatchResultSubmissionScreen] loading match", {
        matchId: route.params.matchId,
        currentUserId: currentUser?.id ?? null,
        reloadKey
      });

      setLoadingMatch(true);
      setLoadError("");

      try {
        const nextMatch = await getMatchForSubmission(route.params.matchId);

        if (!isActive) {
          return;
        }

        setMatch(nextMatch);
        setScoreSummary(nextMatch.scoreSummary ?? "");
        setNotes(nextMatch.resultNotes ?? "");
        setWinnerId(currentUser?.id ?? nextMatch.challengerProfileId);
      } catch (error) {
        if (!isActive) {
          return;
        }

        debugError("[MatchResultSubmissionScreen] failed to load match", error, {
          matchId: route.params.matchId,
          currentUserId: currentUser?.id ?? null,
          reloadKey
        });
        setLoadError(getUserSafeErrorMessage(error, "Unable to load match details."));
        clearSuccess();
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
    }
  }, [clearSuccess, isFocused]);

  useEffect(
    () => () => {
      if (navigateBackTimeoutRef.current) {
        clearTimeout(navigateBackTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const realtimeChannel = subscribeToMatchActivity(currentUser.id, () => {
      if (!isFocused || loading) {
        return;
      }

      setLoadingMatch(true);
      void getMatchForSubmission(route.params.matchId)
        .then((nextMatch) => {
          setMatch(nextMatch);
          setWinnerId((currentWinnerId) =>
            currentWinnerId && [nextMatch.challengerProfileId, nextMatch.opponentProfileId].includes(currentWinnerId)
              ? currentWinnerId
              : currentUser.id ?? nextMatch.challengerProfileId
          );
        })
        .catch((error) => {
          setLoadError(getUserSafeErrorMessage(error, "Unable to load match details."));
        })
        .finally(() => {
          setLoadingMatch(false);
        });
    });

    return () => {
      void realtimeChannel.unsubscribe();
    };
  }, [currentUser?.id, isFocused, loading, route.params.matchId]);

  const participantOpponentId = match
    ? match.challengerProfileId === currentUser?.id
      ? match.opponentProfileId
      : match.challengerProfileId
    : undefined;
  const opponentName = match
    ? match.challengerProfileId === currentUser?.id
      ? match.opponentName
      : match.challengerName
    : "Opponent";

  const loserId = useMemo(() => {
    if (!match || !currentUser || !participantOpponentId) {
      return "";
    }

    return winnerId === currentUser.id ? participantOpponentId : currentUser.id;
  }, [currentUser, match, participantOpponentId, winnerId]);

  if (loadingMatch) {
    return (
      <Screen>
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading match...</Text>
        </View>
      </Screen>
    );
  }

  if (!currentUser || !match) {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="Match not found"
            description={loadError || "This flow needs a valid accepted match before you can record a result."}
          />
          <Button label="Try Again" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
        </Card>
      </Screen>
    );
  }

  if (match.challengeStatus !== "accepted") {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="Result submission unavailable"
            description="Only accepted challenges can move into result reporting."
          />
          <Button label="Refresh Match" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
        </Card>
      </Screen>
    );
  }

  if (match.resultStatus !== "pending_submission") {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="Result already submitted"
            description="This match is already waiting on confirmation or has already been finished."
          />
          <Button label="Refresh Match" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          <Button label="Back to Match Results" tone="secondary" onPress={() => navigation.navigate("ResultsInbox")} />
        </Card>
      </Screen>
    );
  }

  const resolvedMatch = match;
  const resolvedCurrentUser = currentUser;

  async function handleSubmit() {
    if (!winnerId || !loserId) {
      setSubmitError("Choose a winner before submitting.");
      return;
    }

    console.log("[MatchResultSubmissionScreen] submit tapped", {
      matchId: resolvedMatch.id,
      currentUserId: resolvedCurrentUser.id,
      submittedByProfileId: resolvedCurrentUser.id,
      winnerProfileId: winnerId,
      loserProfileId: loserId,
      challengeStatus: resolvedMatch.challengeStatus,
      resultStatus: resolvedMatch.resultStatus
    });
    debugLog("[MatchResultSubmissionScreen] submit tapped", {
      matchId: resolvedMatch.id,
      currentUserId: resolvedCurrentUser.id,
      winnerId,
      loserId
    });

    setSubmitError("");
    clearSuccess();
    setLoading(true);

    try {
      if (navigateBackTimeoutRef.current) {
        clearTimeout(navigateBackTimeoutRef.current);
        navigateBackTimeoutRef.current = null;
      }

      const submittedMatch = await submitResult({
        matchId: resolvedMatch.id,
        winnerProfileId: winnerId,
        loserProfileId: loserId,
        scoreSummary: scoreSummary.trim() || undefined,
        resultNotes: notes.trim() || undefined
      });
      console.log("[MatchResultSubmissionScreen] submit succeeded", {
        matchId: submittedMatch.id,
        resultStatus: submittedMatch.resultStatus,
        submittedByProfileId: submittedMatch.submittedByProfileId,
        winnerProfileId: submittedMatch.winnerProfileId,
        loserProfileId: submittedMatch.loserProfileId
      });
      showSuccess("Result submitted", "Waiting for opponent confirmation.");
      navigateBackTimeoutRef.current = setTimeout(() => {
        navigation.goBack();
        navigateBackTimeoutRef.current = null;
      }, 900);
    } catch (error) {
      const safeError = getSafeErrorPayload(error);
      const submitErrorMessage =
        error instanceof Error && error.message
          ? error.message
          : [safeError.message, safeError.details, safeError.code].filter(Boolean).join(" | ") ||
            "Unable to record the match result.";

      console.error("[MatchResultSubmissionScreen] submit failed", {
        matchId: resolvedMatch.id,
        currentUserId: resolvedCurrentUser.id,
        winnerId,
        loserId,
        error,
        safeError: getSafeErrorPayload(error)
      });
      debugError("[MatchResultSubmissionScreen] submit result failed", error, {
        matchId: resolvedMatch.id,
        currentUserId: resolvedCurrentUser.id,
        winnerId,
        loserId
      });
      setSubmitError(submitErrorMessage);
      try {
        const nextMatch = await getMatchForSubmission(route.params.matchId);
        setMatch(nextMatch);
      } catch (reloadError) {
        debugError("[MatchResultSubmissionScreen] failed to refresh stale match after submit error", reloadError, {
          matchId: route.params.matchId
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      {success ? <SuccessBanner title={success.title} hint={success.hint} onDismiss={clearSuccess} /> : null}
      {success ? (
        <ResolvedStateCard
          title="Waiting for opponent confirmation"
          description="Your result is in. The other player needs to confirm it next."
        />
      ) : null}
      <Card>
        <Text style={styles.sectionTitle}>Record Match Result</Text>
        <Text style={styles.helperText}>Submit the winner now. Your opponent will confirm it next.</Text>
        <Text style={styles.label}>Winner</Text>
        <View style={styles.wrap}>
          <Chip
            label="You"
            selected={winnerId === currentUser.id}
            onPress={() => setWinnerId(currentUser.id)}
          />
          <Chip
            label={opponentName}
            selected={winnerId === participantOpponentId}
            onPress={() => setWinnerId(participantOpponentId ?? "")}
          />
        </View>
      </Card>
      <Input label="Score" value={scoreSummary} onChangeText={setScoreSummary} placeholder="6-4, 6-3 or 21 - 18" />
      <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional match notes" />
      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
      <Card>
        <Text style={styles.helperText}>
          If this screen looks stale after another player acts, refresh the match or report a beta issue with the match ref below.
        </Text>
        <Text style={styles.diagnosticText}>Match ref: {resolvedMatch.id}</Text>
        <Text style={styles.diagnosticText}>Current state: {resolvedMatch.resultStatus}</Text>
        <Button label="Refresh Match" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
        <Button
          label="Report Beta Issue"
          tone="secondary"
          onPress={() =>
            void openBetaFeedbackEmail({
              screen: "MatchResultSubmission",
              profileId: resolvedCurrentUser.id,
              challengeId: resolvedMatch.challengeId,
              matchId: resolvedMatch.id,
              status: resolvedMatch.resultStatus
            })
          }
        />
      </Card>
      <Button
        label={success ? "Waiting for opponent confirmation" : "Record Match Result"}
        onPress={handleSubmit}
        loading={loading}
        disabled={Boolean(success)}
      />
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
  wrap: {
    flexDirection: "row",
    gap: spacing.sm
  },
  helperText: {
    color: colors.textMuted
  },
  diagnosticText: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  stateText: {
    color: colors.textMuted
  },
  error: {
    color: colors.danger,
    fontWeight: "600"
  }
});
