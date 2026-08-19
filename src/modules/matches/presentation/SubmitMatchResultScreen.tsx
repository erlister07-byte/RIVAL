import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { LoopTwoStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { getUserMatch, LoopTwoMatch, submitLoopTwoMatchResult } from "@/services/matchService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { Input } from "@/shared/components/Input";
import { Screen } from "@/shared/components/Screen";
import { formatDateTime } from "@/shared/lib/format";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";

type Props = NativeStackScreenProps<LoopTwoStackParamList, "SubmitMatchResult">;

export function LoopTwoSubmitMatchResultScreen({ navigation, route }: Props) {
  const { currentUser } = useAppState();
  const [match, setMatch] = useState<LoopTwoMatch | null>(null);
  const [winnerProfileId, setWinnerProfileId] = useState("");
  const [scoreSummary, setScoreSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadMatch() {
      setLoading(true);
      setError("");
      try {
        const nextMatch = await getUserMatch(route.params.matchId);
        if (isActive) setMatch(nextMatch);
      } catch (loadError) {
        if (isActive) setError(getUserSafeErrorMessage(loadError, "Unable to load match."));
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadMatch();
    return () => {
      isActive = false;
    };
  }, [route.params.matchId]);

  if (loading) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  if (!match || error) {
    return <Screen><Card><Text style={styles.error}>{error || "Match not found."}</Text><Button label="Back to Matches" tone="secondary" onPress={() => navigation.navigate("MatchInbox")} /></Card></Screen>;
  }
  const terminalState = submitted || match.resultStatus === "pending_confirmation"
    ? { title: "Result Submitted", description: "Waiting for opponent confirmation." }
    : match.resultStatus === "confirmed"
      ? { title: "Result Confirmed", description: "The match result has been confirmed." }
      : match.resultStatus === "disputed"
        ? { title: "Result Disputed", description: "The submitted result was disputed." }
        : null;

  if (terminalState) {
    return (
      <Screen>
        <Card>
          <Text style={styles.title}>{terminalState.title}</Text>
          <Text style={styles.meta}>{terminalState.description}</Text>
          <Button label="Back to Matches" tone="secondary" onPress={() => navigation.navigate("MatchInbox")} />
        </Card>
      </Screen>
    );
  }

  const isCurrentUserChallenger = currentUser?.id === match.challenger.profileId;
  const opponentName = isCurrentUserChallenger ? match.opponent.displayName : match.challenger.displayName;
  const matchId = match.id;

  async function handleSubmit() {
    if (!winnerProfileId) {
      setError("Choose a winner before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitLoopTwoMatchResult({
        matchId,
        winnerProfileId,
        scoreSummary: scoreSummary.trim() || undefined
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(getUserSafeErrorMessage(submitError, "Unable to submit result."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Submit Result</Text>
        <Text style={styles.playerName}>{match.counterpart.displayName}</Text>
        <Text style={styles.meta}>{match.sport} · {match.locationName}</Text>
        {match.scheduledAt ? <Text style={styles.meta}>{formatDateTime(match.scheduledAt)}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.label}>Winner</Text>
        <View style={styles.chips}>
          <Chip label="You" selected={winnerProfileId === currentUser?.id} onPress={() => currentUser && setWinnerProfileId(currentUser.id)} />
          <Chip label={opponentName || "Opponent"} selected={winnerProfileId === match.counterpart.profileId} onPress={() => setWinnerProfileId(match.counterpart.profileId)} />
        </View>
        <Input
          label="Score (optional)"
          value={scoreSummary}
          onChangeText={(value) => setScoreSummary(value.slice(0, 120))}
          placeholder="6-4, 6-3"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Submit Result" onPress={() => void handleSubmit()} loading={submitting} disabled={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: "700" },
  playerName: { color: colors.text, fontSize: typography.bodyStrong, fontWeight: "700", marginTop: spacing.sm },
  label: { color: colors.textMuted, fontWeight: "700", marginBottom: spacing.sm, textTransform: "uppercase" },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  error: { color: colors.error, marginVertical: spacing.sm }
});
