import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { LoopTwoStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import {
  confirmLoopTwoMatchResult,
  getUserMatches,
  LoopTwoMatch,
  rejectLoopTwoMatchResult
} from "@/services/matchService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";
import { formatDateTime } from "@/shared/lib/format";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";

type Props = NativeStackScreenProps<LoopTwoStackParamList, "MatchInbox">;

function getWinnerName(match: LoopTwoMatch) {
  if (match.winnerProfileId === match.challenger.profileId) return match.challenger.displayName;
  if (match.winnerProfileId === match.opponent.profileId) return match.opponent.displayName;
  return "Not recorded";
}

export function LoopTwoMatchInboxScreen({ navigation }: Props) {
  const isFocused = useIsFocused();
  const [matches, setMatches] = useState<LoopTwoMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actioningMatchId, setActioningMatchId] = useState("");

  useEffect(() => {
    if (!isFocused) return;

    let isActive = true;

    async function loadMatches() {
      setLoading(true);
      setError("");
      try {
        const nextMatches = await getUserMatches();
        if (isActive) setMatches(nextMatches);
      } catch (loadError) {
        if (isActive) {
          setMatches([]);
          setError(getUserSafeErrorMessage(loadError, "Unable to load matches."));
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadMatches();
    return () => {
      isActive = false;
    };
  }, [isFocused, reloadKey]);

  async function handleResultAction(match: LoopTwoMatch, action: "confirm" | "dispute") {
    setActioningMatchId(match.id);
    setError("");

    try {
      const nextMatch = action === "confirm"
        ? await confirmLoopTwoMatchResult(match.id)
        : await rejectLoopTwoMatchResult(match.id);
      setMatches((previous) => previous.map((item) => (
        item.id === nextMatch.id
          ? {
              ...item,
              resultStatus: nextMatch.resultStatus,
              confirmedAt: nextMatch.confirmedAt ?? item.confirmedAt,
              waitingForOpponent: false,
              waitingForCurrentUser: false
            }
          : item
      )));
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      setError(getUserSafeErrorMessage(actionError, `Unable to ${action} match result.`));
    } finally {
      setActioningMatchId("");
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Matches</Text>
        <Text style={styles.meta}>Record, review, or view a match result.</Text>
        <Button label="Refresh" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && !error && matches.length === 0 ? (
        <Card><EmptyState title="No matches to review" description="Accepted matches and their result states will appear here." /></Card>
      ) : null}
      {!loading ? matches.map((match) => (
        <Card key={match.id}>
          <Text style={styles.playerName}>{match.counterpart.displayName}</Text>
          <Text style={styles.meta}>{match.sport} · {match.locationName}</Text>
          {match.scheduledAt ? <Text style={styles.meta}>{formatDateTime(match.scheduledAt)}</Text> : null}
          {match.resultStatus === "pending_submission" ? (
            <View style={styles.actions}>
              <Text style={styles.status}>Ready for a result</Text>
              <Button label="Submit Result" onPress={() => navigation.navigate("SubmitMatchResult", { matchId: match.id })} />
            </View>
          ) : match.resultStatus === "confirmed" ? (
            <View style={styles.actions}>
              <Text style={styles.status}>Result Confirmed</Text>
              <Text style={styles.meta}>Winner: {getWinnerName(match)}</Text>
              {match.scoreSummary ? <Text style={styles.meta}>Score: {match.scoreSummary}</Text> : null}
            </View>
          ) : match.resultStatus === "disputed" ? (
            <View style={styles.actions}>
              <Text style={styles.status}>Result Disputed</Text>
              <Text style={styles.meta}>The submitted result was disputed.</Text>
              <Text style={styles.meta}>Winner: {getWinnerName(match)}</Text>
              {match.scoreSummary ? <Text style={styles.meta}>Score: {match.scoreSummary}</Text> : null}
            </View>
          ) : (
            <View style={styles.actions}>
              <Text style={styles.status}>Result Submitted</Text>
              <Text style={styles.meta}>
                {match.waitingForOpponent ? "Waiting for opponent confirmation." : "Review the submitted result."}
              </Text>
              <Text style={styles.meta}>Winner: {getWinnerName(match)}</Text>
              {match.scoreSummary ? <Text style={styles.meta}>Score: {match.scoreSummary}</Text> : null}
              {match.waitingForCurrentUser ? (
                <>
                  <Button
                    label="Confirm Result"
                    onPress={() => void handleResultAction(match, "confirm")}
                    loading={actioningMatchId === match.id}
                    disabled={Boolean(actioningMatchId)}
                  />
                  <Button
                    label="Dispute Result"
                    tone="secondary"
                    onPress={() => void handleResultAction(match, "dispute")}
                    disabled={Boolean(actioningMatchId)}
                  />
                </>
              ) : null}
            </View>
          )}
        </Card>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: "700" },
  playerName: { color: colors.text, fontSize: typography.bodyStrong, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  status: { color: colors.text, fontWeight: "700" },
  error: { color: colors.error, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md }
});
