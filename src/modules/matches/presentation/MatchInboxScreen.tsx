import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { LoopTwoStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { getUserMatches, LoopTwoMatch } from "@/services/matchService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";
import { formatDateTime } from "@/shared/lib/format";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";

type Props = NativeStackScreenProps<LoopTwoStackParamList, "MatchInbox">;

export function LoopTwoMatchInboxScreen({ navigation }: Props) {
  const isFocused = useIsFocused();
  const [matches, setMatches] = useState<LoopTwoMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Matches</Text>
        <Text style={styles.meta}>Record a result or view its current waiting state.</Text>
        <Button label="Refresh" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && !error && matches.length === 0 ? (
        <Card><EmptyState title="No active matches" description="Accepted matches that need a result will appear here." /></Card>
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
          ) : (
            <View style={styles.actions}>
              <Text style={styles.status}>Result Submitted</Text>
              <Text style={styles.meta}>
                {match.waitingForOpponent ? "Waiting for opponent confirmation." : "Your opponent submitted a result. Confirmation is not part of this loop."}
              </Text>
              {match.scoreSummary ? <Text style={styles.meta}>Score: {match.scoreSummary}</Text> : null}
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
