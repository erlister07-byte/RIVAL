import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/application/providers/AppProvider";
import { AppStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { getChallengeTypeLabel, getStakeDisplay } from "@/core/types/models";
import { Badge } from "@/components/ui/Badge";
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
import { getDiagnosticErrorMessage } from "@/shared/lib/serviceError";

type Props = NativeStackScreenProps<AppStackParamList, "ResultsInbox">;

export function ResultsInboxScreen({ navigation }: Props) {
  const { currentUser, matches, challenges, isHydratingProfile } = useAppState();
  const isFocused = useIsFocused();
  const [liveMatches, setLiveMatches] = useState(matches);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  if (!currentUser?.id && isHydratingProfile) {
    return (
      <Screen>
        <Card>
          <Text style={styles.sectionTitle}>Match Results</Text>
          <Text style={styles.helperText}>We’re restoring your profile before loading actionable matches.</Text>
        </Card>
      </Screen>
    );
  }

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
        setRefreshError(getDiagnosticErrorMessage(error, "Live match updates are delayed. Try refreshing this screen."));
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
          setRefreshError(getDiagnosticErrorMessage(error, "Live match updates are delayed. Try refreshing this screen."));
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
          const opponentName = isChallenger ? match.opponentName : match.challengerName;
          const actionNeeded =
            match.resultStatus === "pending_confirmation" ? "Confirm result" : "Submit result";

          return {
            match,
            challenge: linkedChallenge,
            opponentName: opponentName?.trim() || "Opponent",
            actionNeeded
          };
        })
        : [],
    [challenges, currentUser, liveMatches]
  );

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

      {loadingMatches ? (
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
        actionableMatches.map(({ match, challenge, opponentName, actionNeeded }) => (
          <Card key={match.id}>
            <View style={styles.rowTop}>
              <View style={styles.rowTitleWrap}>
                <Text style={styles.playerName}>{opponentName}</Text>
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
              <>
                {match.resultOutcome === "draw" ? <Text style={styles.statusText}>Proposed result: Draw</Text> : null}
                <Text style={styles.deadlineText}>
                  Awaiting opponent response · {formatResultConfirmationDeadline(match.resultConfirmationDeadlineAt)}
                </Text>
              </>
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
