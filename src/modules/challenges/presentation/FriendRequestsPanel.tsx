import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/application/theme";
import { acceptFriendRequest, cancelFriendRequest, declineFriendRequest, getFriendRequests, SocialFriendRequest, SocialFriendRequests } from "@/services/socialService";
import { getSocialUiError } from "@/modules/profile/presentation/socialUiError";
import { Avatar } from "@/shared/components/Avatar";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

type Props = { isFocused: boolean; userId?: string; onViewProfile: (id: string) => void };

export function FriendRequestsPanel({ isFocused, userId, onViewProfile }: Props) {
  const [requests, setRequests] = useState<SocialFriendRequests>({ incoming: [], outgoing: [] });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  const scope = useMemo(() => ({ active: false, refreshSequence: 0 }), [userId, isFocused]);
  useLayoutEffect(() => {
    scope.active = isFocused && Boolean(userId);
    mutationLock.current = false;
    setBusyId(null);
    setError("");
    return () => { scope.active = false; };
  }, [scope]);

  useEffect(() => {
    if (!isFocused || !userId) return;
    let active = true;
    const refreshSequence = ++scope.refreshSequence;
    setState("loading");
    setError("");
    void getFriendRequests().then((result) => {
      if (active && scope.active && refreshSequence === scope.refreshSequence) { setRequests(result); setLoadedUserId(userId); setState("ready"); }
    }).catch(() => {
      if (active && scope.active && refreshSequence === scope.refreshSequence) { setRequests({ incoming: [], outgoing: [] }); setLoadedUserId(userId); setState("error"); }
    });
    return () => { active = false; };
  }, [isFocused, reload, userId, scope]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (isFocused && next === "active") setReload((value) => value + 1);
    });
    return () => subscription.remove();
  }, [isFocused]);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    if (!scope.active || loadedUserId !== userId || mutationLock.current) return;
    mutationLock.current = true;
    // Invalidate pre-mutation reads; every subsequent refresh also owns a sequence.
    ++scope.refreshSequence;
    let refreshSequence: number | null = null;
    setBusyId(id);
    setError("");
    try {
      if (action === "accept") await acceptFriendRequest(id);
      if (action === "decline") await declineFriendRequest(id);
      if (action === "cancel") await cancelFriendRequest(id);
      if (!scope.active) return;
      refreshSequence = ++scope.refreshSequence;
      const latest = await getFriendRequests();
      if (!scope.active || refreshSequence !== scope.refreshSequence) return;
      setRequests(latest);
      setState("ready");
    } catch (failure) {
      if (!scope.active || (refreshSequence !== null && refreshSequence !== scope.refreshSequence)) return;
      setError(getSocialUiError(failure));
      try {
        refreshSequence = ++scope.refreshSequence;
        const latest = await getFriendRequests();
        if (!scope.active || refreshSequence !== scope.refreshSequence) return;
        setRequests(latest);
        setState("ready");
      } catch {
        if (!scope.active || refreshSequence !== scope.refreshSequence) return;
        setRequests({ incoming: [], outgoing: [] });
        setState("error");
      }
    } finally {
      if (scope.active) {
        mutationLock.current = false;
        setBusyId(null);
      }
    }
  }

  function requestRow(request: SocialFriendRequest, direction: "incoming" | "outgoing") {
    const { profile } = request;
    return <View key={`${direction}-${profile.id}`} style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${profile.displayName}'s profile`}
        onPress={() => onViewProfile(profile.id)}
        style={styles.identity}
      >
        <Avatar username={profile.username} displayName={profile.displayName} size={44} />
        <View>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.meta}>@{profile.username}</Text>
        </View>
      </Pressable>
      {direction === "incoming" ? <View style={styles.actions}>
        <Button label={`Accept ${profile.displayName}`} tone="secondary" onPress={() => void act(profile.id, "accept")} loading={busyId === profile.id} disabled={busyId !== null} />
        <Button label={`Decline ${profile.displayName}`} tone="secondary" onPress={() => void act(profile.id, "decline")} disabled={busyId !== null} />
      </View> : <>
        <Text style={styles.meta}>Request Sent</Text>
        <Button label={`Cancel request to ${profile.displayName}`} tone="secondary" onPress={() => void act(profile.id, "cancel")} loading={busyId === profile.id} disabled={busyId !== null} />
      </>}
    </View>;
  }

  const visibleState = loadedUserId === userId ? state : "loading";

  return <Card>
    <Text style={styles.heading}>Friend Requests</Text>
    {error ? <>
      <Text style={styles.error}>{error}</Text>
      <Button label="Refresh Friend Requests" tone="secondary" onPress={() => setReload((value) => value + 1)} disabled={busyId !== null} />
    </> : null}
    {visibleState === "loading" ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading friend requests" /> : null}
    {visibleState === "error" ? <>
      <Text style={styles.meta}>Unable to load friend requests right now.</Text>
      <Button label="Retry Friend Requests" tone="secondary" onPress={() => setReload((value) => value + 1)} />
    </> : null}
    {visibleState === "ready" ? <>
      <Text style={styles.section}>Incoming ({requests.incoming.length})</Text>
      {requests.incoming.length ? requests.incoming.map((request) => requestRow(request, "incoming")) : <Text style={styles.meta}>No incoming friend requests.</Text>}
      <Text style={styles.section}>Sent ({requests.outgoing.length})</Text>
      {requests.outgoing.length ? requests.outgoing.map((request) => requestRow(request, "outgoing")) : <Text style={styles.meta}>No sent friend requests.</Text>}
    </> : null}
  </Card>;
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: typography.subheading, fontWeight: "700" },
  section: { color: colors.text, fontWeight: "700", marginTop: spacing.md },
  row: { gap: spacing.sm, paddingVertical: spacing.md },
  identity: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  name: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted },
  error: { color: colors.danger, marginTop: spacing.sm }
});
