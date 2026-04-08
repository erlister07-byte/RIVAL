import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, StyleSheet, Text, View } from "react-native";

import { AppStackParamList, MainTabParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { getChallengeTypeLabel, getStakeDisplay } from "@/core/types/models";
import {
  cancelChallenge,
  getChallengeInboxActivitySummary,
  ChallengeInboxItem,
  getReceivedChallengeInbox,
  getSentChallengeInbox,
  subscribeToChallengeActivity
} from "@/services/challengeService";
import {
  getChallengeInboxLastViewedAt,
  markChallengeInboxViewed
} from "@/services/challengeInboxActivityStore";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";
import { SuccessBanner } from "@/shared/components/SuccessBanner";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/shared/lib/format";
import { debugError, debugLog } from "@/shared/lib/logger";
import { openBetaFeedbackEmail } from "@/shared/lib/betaFeedback";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";
import { useTimedSuccess } from "@/shared/lib/useTimedSuccess";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "ChallengeInbox">,
  NativeStackScreenProps<AppStackParamList>
>;

export function ChallengeInboxScreen({ navigation }: Props) {
  const { currentUser, respondToChallenge } = useAppState();
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [receivedChallenges, setReceivedChallenges] = useState<ChallengeInboxItem[]>([]);
  const [sentChallenges, setSentChallenges] = useState<ChallengeInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { success, showSuccess, clearSuccess } = useTimedSuccess();
  const [newActivitySummary, setNewActivitySummary] = useState<{
    incomingPendingCount: number;
    acceptedOutgoingCount: number;
    totalCount: number;
  } | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadInbox() {
      if (!currentUser?.id || !isFocused) {
        if (isActive) {
          setReceivedChallenges([]);
          setSentChallenges([]);
          if (!currentUser?.id) {
            setLoading(false);
          }
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        const lastViewedAt = await getChallengeInboxLastViewedAt(currentUser.id);
        const [received, sent, activitySummary] = await Promise.all([
          getReceivedChallengeInbox(currentUser.id),
          getSentChallengeInbox(currentUser.id),
          getChallengeInboxActivitySummary(currentUser.id, lastViewedAt)
        ]);

        if (isActive) {
          setReceivedChallenges(received);
          setSentChallenges(sent);
          setNewActivitySummary(activitySummary);
          await markChallengeInboxViewed(currentUser.id);
        }
      } catch (loadError) {
        if (isActive) {
          setError(getUserSafeErrorMessage(loadError, "Unable to load challenges right now."));
          setReceivedChallenges([]);
          setSentChallenges([]);
          setNewActivitySummary(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadInbox();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, isFocused, reloadKey]);

  useEffect(() => {
    if (!isFocused) {
      clearSuccess();
    }
  }, [clearSuccess, isFocused]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isFocused) {
        setReloadKey((value) => value + 1);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isFocused]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const realtimeChannel = subscribeToChallengeActivity(currentUser.id, () => {
      setReloadKey((value) => value + 1);
    });

    return () => {
      void realtimeChannel.unsubscribe();
    };
  }, [currentUser?.id]);

  const items = activeTab === "received" ? receivedChallenges : sentChallenges;

  async function handleResponse(challenge: ChallengeInboxItem, status: "accepted" | "declined") {
    debugLog("[ChallengeInboxScreen] handling challenge response", {
      challengeId: challenge.id,
      status
    });

    setBusyId(challenge.id);
    setError("");
    clearSuccess();

    try {
      await respondToChallenge(challenge.id, status);

      setReceivedChallenges((current) =>
        status === "declined"
          ? current.filter((item) => item.id !== challenge.id)
          : current.map((item) =>
              item.id === challenge.id
                ? {
                    ...item,
                    status
                  }
                : item
            )
      );
      showSuccess(
        status === "accepted" ? "Challenge accepted" : "Challenge declined",
        status === "accepted"
          ? `You can now play your match · Stakes: ${getStakeDisplay(challenge.stakeType, challenge.stakeLabel)}`
          : "This challenge has been removed from your inbox."
      );
      setReloadKey((value) => value + 1);
    } catch (responseError) {
      debugError("[ChallengeInboxScreen] challenge response failed", responseError, {
        challengeId: challenge.id,
        status
      });
      setError(getUserSafeErrorMessage(responseError, "Unable to update challenge right now."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelChallenge(challenge: ChallengeInboxItem) {
    if (!currentUser?.id || challenge.challengerProfileId !== currentUser.id || challenge.status !== "pending") {
      setError("Unable to cancel challenge right now.");
      return;
    }

    setBusyId(challenge.id);
    setError("");
    clearSuccess();

    try {
      await cancelChallenge(challenge.id, currentUser.id);

      setSentChallenges((current) => current.filter((item) => item.id !== challenge.id));
      showSuccess("Challenge cancelled.");
      setReloadKey((value) => value + 1);
    } catch (cancelError) {
      debugError("[ChallengeInboxScreen] cancel challenge failed", cancelError, {
        challengeId: challenge.id
      });
      setError(getUserSafeErrorMessage(cancelError, "Unable to cancel challenge right now."));
    } finally {
      setBusyId(null);
    }
  }

  function confirmCancelChallenge(challenge: ChallengeInboxItem) {
    Alert.alert(
      "Cancel this challenge?",
      "This will remove the challenge before it’s accepted.",
      [
        {
          text: "Keep Challenge",
          style: "cancel"
        },
        {
          text: "Cancel Challenge",
          style: "destructive",
          onPress: () => {
            void handleCancelChallenge(challenge);
          }
        }
      ]
    );
  }

  return (
    <Screen>
      {success ? <SuccessBanner title={success.title} hint={success.hint} onDismiss={clearSuccess} /> : null}
      {newActivitySummary && newActivitySummary.totalCount > 0 ? (
        <Card style={styles.activityBanner}>
          <Text style={styles.activityBannerTitle}>New challenge activity</Text>
          <Text style={styles.activityBannerText}>
            {newActivitySummary.incomingPendingCount > 0
              ? `${newActivitySummary.incomingPendingCount} new incoming ${newActivitySummary.incomingPendingCount === 1 ? "challenge" : "challenges"}`
              : null}
            {newActivitySummary.incomingPendingCount > 0 && newActivitySummary.acceptedOutgoingCount > 0 ? " · " : ""}
            {newActivitySummary.acceptedOutgoingCount > 0
              ? `${newActivitySummary.acceptedOutgoingCount} sent ${newActivitySummary.acceptedOutgoingCount === 1 ? "challenge was" : "challenges were"} accepted`
              : null}
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.tabs}>
          <Chip
            label={`Received (${receivedChallenges.length})`}
            selected={activeTab === "received"}
            onPress={() => setActiveTab("received")}
          />
          <Chip
            label={`Sent (${sentChallenges.length})`}
            selected={activeTab === "sent"}
            onPress={() => setActiveTab("sent")}
          />
        </View>
        <Button label="Refresh Inbox" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
        <Button
          label="Report Beta Issue"
          tone="secondary"
          onPress={() =>
            void openBetaFeedbackEmail({
              screen: "ChallengeInbox",
              profileId: currentUser?.id ?? null,
              status: activeTab
            })
          }
        />
      </Card>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading challenges...</Text>
        </View>
      ) : error ? (
        <Card>
          <Text style={styles.errorTitle}>Could not load challenge inbox</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Button label="Try Again" onPress={() => setReloadKey((value) => value + 1)} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={activeTab === "received" ? "No active challenges waiting on you" : "No active challenges sent yet"}
            description={
              activeTab === "received"
                ? "Find a nearby player and start your first match, or check back when someone challenges you."
                : "Find a nearby player or challenge a friend by username to start your next match."
            }
          />
          <Button
            label={activeTab === "received" ? "Find Nearby Players" : "Challenge a Player"}
            onPress={() =>
              activeTab === "received" ? navigation.navigate("NearbyPlayers") : navigation.navigate("CreateChallenge")
            }
          />
        </Card>
      ) : (
        items.map((challenge) => (
          <Card key={challenge.id}>
            <Text style={styles.playerName}>{challenge.counterpartName}</Text>
            <Text style={styles.meta}>
              {challenge.sport} · {getChallengeTypeLabel(challenge.challengeType)}
            </Text>
            <Text style={styles.meta}>{formatDateTime(challenge.scheduledAt)}</Text>
            <Text style={styles.meta}>
              {challenge.locationName} · {getStakeDisplay(challenge.stakeType, challenge.stakeLabel)}
            </Text>
            <Badge
              label={challenge.status}
              tone={
                challenge.status === "accepted"
                  ? "success"
                  : challenge.status === "declined"
                    ? "error"
                    : "default"
              }
            />
            {challenge.stakeNote ? <Text style={styles.note}>{challenge.stakeNote}</Text> : null}

            {activeTab === "received" && challenge.status === "pending" ? (
              <View style={styles.actions}>
                <Button
                  label="Accept"
                  onPress={() => handleResponse(challenge, "accepted")}
                  loading={busyId === challenge.id}
                />
                <Button
                  label="Decline"
                  tone="secondary"
                  onPress={() => handleResponse(challenge, "declined")}
                  disabled={busyId === challenge.id}
                />
              </View>
            ) : null}

            {activeTab === "sent" &&
            challenge.status === "pending" &&
            challenge.challengerProfileId === currentUser?.id ? (
              <View style={styles.actions}>
                <Button
                  label="Cancel Challenge"
                  tone="danger"
                  onPress={() => confirmCancelChallenge(challenge)}
                  loading={busyId === challenge.id}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}

      <Button label="Challenge a Player" onPress={() => navigation.navigate("CreateChallenge")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerName: {
    fontWeight: "700",
    fontSize: typography.subheading,
    color: colors.text
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 22
  },
  note: {
    color: colors.text,
    lineHeight: 22
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  stateText: {
    color: colors.textMuted,
    textAlign: "center"
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: typography.subheading
  },
  activityBanner: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(91,33,182,0.14)"
  },
  activityBannerTitle: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: typography.subheading
  },
  activityBannerText: {
    color: colors.text,
    lineHeight: 22
  }
});
