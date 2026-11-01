import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { useAppState } from "@/application/providers/AppProvider";
import { colors, spacing, typography } from "@/application/theme";
import { getBlockedPlayers, SocialBlockedPlayer, unblockPlayer } from "@/services/socialService";
import { getSocialUiError } from "@/modules/profile/presentation/socialUiError";
import { notifySocialUiChanged } from "@/modules/profile/presentation/socialUiRefresh";
import { Avatar } from "@/shared/components/Avatar";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "BlockedPlayers">;

export function BlockedPlayersScreen({ navigation: _navigation }: Props) {
  const { currentUser } = useAppState();
  const isFocused = useIsFocused();
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<SocialBlockedPlayer[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [mutationError, setMutationError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const mutationLock = useRef(false);

  // Each account/focus lifetime owns its confirmations and async completions.
  const scope = useMemo(() => ({ active: false }), [currentUser?.id, isFocused]);
  useLayoutEffect(() => {
    scope.active = isFocused && Boolean(currentUser?.id);
    mutationLock.current = false;
    setBusyId(null);
    setMutationError("");
    return () => { scope.active = false; };
  }, [scope]);

  useEffect(() => {
    if (!isFocused || !currentUser?.id) return;
    let active = true;
    const userId = currentUser.id;
    setState("loading");
    setMutationError("");
    void getBlockedPlayers().then((result) => {
      if (active && scope.active) {
        setBlocked(result);
        setLoadedUserId(userId);
        setState("ready");
      }
    }).catch(() => {
      if (active && scope.active) {
        setBlocked([]);
        setLoadedUserId(userId);
        setState("error");
      }
    });
    return () => { active = false; };
  }, [currentUser?.id, isFocused, reload, scope]);

  async function submitUnblock(player: SocialBlockedPlayer) {
    if (!scope.active || mutationLock.current || loadedUserId !== currentUser?.id) return;
    mutationLock.current = true;
    setBusyId(player.profile.id);
    setMutationError("");
    try {
      await unblockPlayer(player.profile.id);
      if (!scope.active) return;
      notifySocialUiChanged();
      setState("loading");
      setReload((value) => value + 1);
    } catch (error) {
      if (scope.active) setMutationError(getSocialUiError(error));
    } finally {
      if (scope.active) {
        mutationLock.current = false;
        setBusyId(null);
      }
    }
  }

  function confirmUnblock(player: SocialBlockedPlayer) {
    if (!scope.active || mutationLock.current || loadedUserId !== currentUser?.id) return;
    const title = `Unblock ${player.profile.displayName}?`;
    const message = "You may be able to find and challenge each other again, unless another restriction applies. Unblocking will not restore your previous friendship, friend requests, or canceled challenges.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) void submitUnblock(player);
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", onPress: () => void submitUnblock(player) }
    ]);
  }

  const visibleState = loadedUserId === currentUser?.id ? state : "loading";

  return <Screen>
    <Card>
      <Text style={styles.heading}>Blocked Players</Text>
      {visibleState === "loading" ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading blocked players" /> : null}
      {visibleState === "error" ? <>
        <Text style={styles.meta}>Unable to load blocked players right now.</Text>
        <Button label="Retry Blocked Players" tone="secondary" onPress={() => setReload((value) => value + 1)} />
      </> : null}
      {mutationError ? <Text style={styles.error}>{mutationError}</Text> : null}
      {visibleState === "ready" && blocked.length === 0 ?
        <EmptyState title="No blocked players" description="Players you block will appear here." /> : null}
      {visibleState === "ready" ? blocked.map((player) => <View key={player.profile.id} style={styles.row}>
        <Avatar username={player.profile.username} displayName={player.profile.displayName} size={44} />
        <View style={styles.identity}>
          <Text style={styles.name}>{player.profile.displayName}</Text>
          <Text style={styles.meta}>@{player.profile.username}</Text>
        </View>
        <Button label={`Unblock ${player.profile.displayName}`} tone="secondary" onPress={() => confirmUnblock(player)} loading={busyId === player.profile.id} disabled={busyId !== null} />
      </View>) : null}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: typography.subheading, fontWeight: "700", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.md },
  identity: { flex: 1, minWidth: 120 },
  name: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted },
  error: { color: colors.danger, marginTop: spacing.sm }
});
