import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";

import { buildRematchChallengeParams } from "@/application/navigation/challengeNavigation";
import { AppStackParamList } from "@/application/navigation/types";
import { useAppState } from "@/application/providers/AppProvider";
import { colors, spacing, typography } from "@/application/theme";
import { DEFAULT_LAUNCH_SPORT, getSportIdBySlug, isSportEnabled } from "@/config/sports";
import { getSkillLevelLabel } from "@/core/types/models";
import { getOpponentProfile, OpponentProfile, OpponentUnavailableError } from "@/services/opponentProfileService";
import { acceptFriendRequest, blockPlayer, cancelFriendRequest, declineFriendRequest, getRelationship, removeFriend, sendFriendRequest, SocialRelationshipState, SocialServiceError } from "@/services/socialService";
import { getSocialUiError } from "@/modules/profile/presentation/socialUiError";
import { notifySocialUiChanged } from "@/modules/profile/presentation/socialUiRefresh";
import { Avatar } from "@/shared/components/Avatar";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "OpponentProfile">;

export function OpponentProfileScreen({ navigation, route }: Props) {
  const { currentUser } = useAppState();
  const { opponentProfileId, confirmedMatchSport, sourceSport } = route.params;
  const [profile, setProfile] = useState<OpponentProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [reload, setReload] = useState(0);
  const isFocused = useIsFocused();
  const mutationLock = useRef(false);
  const [relationship, setRelationship] = useState<SocialRelationshipState | null>(null);
  const [relationshipError, setRelationshipError] = useState("");
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [relationshipReload, setRelationshipReload] = useState(0);
  const blockLock = useRef(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState("");

  const actionScope = useMemo(() => ({ active: false }), [currentUser?.id, isFocused, opponentProfileId]);
  useLayoutEffect(() => {
    actionScope.active = isFocused && Boolean(currentUser?.id);
    blockLock.current = false;
    mutationLock.current = false;
    setRelationshipBusy(false);
    setBlockBusy(false);
    setBlockError("");
    return () => { actionScope.active = false; };
  }, [actionScope]);

  useEffect(() => {
    if (!isFocused) return;
    if (currentUser?.id === opponentProfileId) {
      navigation.replace("Tabs", { screen: "Profile" });
      return;
    }
    let active = true;
    setState("loading");
    setProfile(null);
    void getOpponentProfile(opponentProfileId).then((result) => {
      if (active) {
        setProfile(result);
        setState("ready");
      }
    }).catch((error: unknown) => {
      if (active) setState(error instanceof OpponentUnavailableError ? "unavailable" : "error");
    });
    return () => { active = false; };
  }, [currentUser?.id, isFocused, navigation, opponentProfileId, reload]);

  useEffect(() => {
    if (!isFocused || currentUser?.id === opponentProfileId) return;
    let active = true;
    setRelationship(null);
    setRelationshipError("");
    void getRelationship(opponentProfileId).then((result) => {
      if (active) setRelationship(result);
    }).catch((error: unknown) => {
      if (active) {
        if (error instanceof SocialServiceError && error.code === "not_found_or_unavailable") {
          setProfile(null);
          setState("unavailable");
        }
        setRelationshipError(getSocialUiError(error));
      }
    });
    return () => { active = false; };
  }, [currentUser?.id, isFocused, opponentProfileId, relationshipReload]);

  async function mutateRelationship(action: "send" | "accept" | "decline" | "cancel" | "remove") {
    if (!actionScope.active || mutationLock.current || blockLock.current) return;
    mutationLock.current = true;
    setRelationshipBusy(true);
    setRelationshipError("");
    try {
      if (action === "send") await sendFriendRequest(opponentProfileId);
      if (action === "accept") await acceptFriendRequest(opponentProfileId);
      if (action === "decline") await declineFriendRequest(opponentProfileId);
      if (action === "cancel") await cancelFriendRequest(opponentProfileId);
      if (action === "remove") await removeFriend(opponentProfileId);
      if (!actionScope.active) return;
      setRelationship(null);
      const latest = await getRelationship(opponentProfileId);
      if (actionScope.active) setRelationship(latest);
    } catch (error) {
      if (!actionScope.active) return;
      setRelationship(null);
      try {
        const latest = await getRelationship(opponentProfileId);
        if (!actionScope.active) return;
        setRelationship(latest);
        if (latest === relationship) setRelationshipError(getSocialUiError(error));
      } catch (refreshError) {
        if (!actionScope.active) return;
        if (refreshError instanceof SocialServiceError && refreshError.code === "not_found_or_unavailable") {
          setProfile(null);
          setState("unavailable");
        }
        setRelationshipError(getSocialUiError(refreshError));
      }
    } finally {
      if (actionScope.active) {
        mutationLock.current = false;
        setRelationshipBusy(false);
      }
    }
  }

  function confirmRemoveFriend() {
    if (!profile || relationshipBusy) return;
    const title = `Remove ${profile.displayName} from friends?`;
    const message = "Previous matches, stats, and rivalry history will not change.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) void mutateRelationship("remove");
      return;
    }
    Alert.alert(title, message, [
      { text: "Keep Friend", style: "cancel" },
      { text: "Remove Friend", style: "destructive", onPress: () => void mutateRelationship("remove") }
    ]);
  }

  async function submitBlock() {
    if (!actionScope.active || blockLock.current || mutationLock.current || !profile || currentUser?.id === profile.id) return;
    blockLock.current = true;
    setBlockBusy(true);
    setBlockError("");
    try {
      await blockPlayer(profile.id);
      if (!actionScope.active) return;
      setRelationship(null);
      setRelationshipError("");
      setProfile(null);
      setState("unavailable");
      notifySocialUiChanged();
    } catch (error) {
      if (!actionScope.active) return;
      if (error instanceof SocialServiceError && error.code === "not_found_or_unavailable") {
        setRelationship(null);
        setProfile(null);
        setState("unavailable");
      } else {
        setBlockError(getSocialUiError(error));
      }
    } finally {
      if (actionScope.active) {
        blockLock.current = false;
        setBlockBusy(false);
      }
    }
  }

  function confirmBlock() {
    if (!profile || blockBusy || relationshipBusy || currentUser?.id === profile.id) return;
    const title = `Block ${profile.displayName}?`;
    const message = "You and this player will no longer be able to find each other, send new challenges, or send friend requests. Your friendship and pending requests will end, and pending direct challenges between you will be canceled. Existing accepted matches and match history will remain.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) void submitBlock();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Block Player", style: "destructive", onPress: () => void submitBlock() }
    ]);
  }

  if (state !== "ready" || !profile) {
    return (
      <Screen>
        <Card>
          {state === "loading" ? <ActivityIndicator color={colors.primary} /> : null}
          <Text style={styles.body}>{state === "loading" ? "Loading opponent profile…" :
            state === "unavailable" ? "This profile is unavailable." : "Unable to load this profile right now."}</Text>
          {state === "error" ? <Button label="Retry" onPress={() => setReload((value) => value + 1)} /> : null}
        </Card>
      </Screen>
    );
  }

  const isRematch = Boolean(confirmedMatchSport && isSportEnabled(confirmedMatchSport));
  const selectedSport = isRematch ? confirmedMatchSport : sourceSport && isSportEnabled(sourceSport) ? sourceSport : DEFAULT_LAUNCH_SPORT;
  function openChallenge() {
    if (!profile || !selectedSport) return;
    navigation.navigate("CreateChallenge", isRematch ? buildRematchChallengeParams({
      opponentProfileId: profile.id,
      opponentName: profile.displayName,
      opponentUsername: profile.username,
      sport: selectedSport
    }) : {
      opponentId: profile.id,
      opponentName: profile.displayName,
      opponentUsername: profile.username,
      sportId: getSportIdBySlug(selectedSport)
    });
  }

  return (
    <Screen>
      <Card>
        <View style={styles.identity}>
          <Avatar profileId={profile.id} username={profile.username} displayName={profile.displayName} size={72} />
          <View style={styles.identityText}>
            <Text style={styles.title}>{profile.displayName}</Text>
            <Text style={styles.body}>@{profile.username}</Text>
            {profile.area ? <Text style={styles.body}>{profile.area}</Text> : null}
          </View>
        </View>
      </Card>
      <Card>
        <Text style={styles.heading}>Sports</Text>
        {profile.sports.length === 0 ? <Text style={styles.body}>No active sports yet.</Text> :
          profile.sports.map((sport) => (
            <View key={sport.sport} style={styles.sport}>
              <Text style={styles.title}>{sport.sport}</Text>
              <Text style={styles.body}>Self-assessed skill: {getSkillLevelLabel(sport.selfAssessedSkill)}</Text>
              <Text style={styles.body}>Competitive Skill Rating: {sport.skillRating === null ? "Unrated" : sport.skillRating}</Text>
            </View>
          ))}
      </Card>
      <Card>
        <Text style={styles.heading}>Confirmed global record</Text>
        <Text style={styles.body}>Wins: {profile.record.wins} · Losses: {profile.record.losses} · Draws: {profile.record.draws}</Text>
        <Text style={styles.body}>Matches played: {profile.record.matchesPlayed}</Text>
      </Card>
      <Button label={isRematch ? "Rematch" : "Challenge"} onPress={openChallenge} />
      <Card>
        <Text style={styles.heading}>Friendship</Text>
        {relationship === null && !relationshipError ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading friendship" /> : null}
        {relationshipError ? <>
          <Text style={styles.body}>{relationshipError}</Text>
          <Button label="Retry Friendship" tone="secondary" onPress={() => setRelationshipReload((value) => value + 1)} disabled={relationshipBusy} />
        </> : null}
        {!relationshipError && relationship === "none" ? <Button label="Add Friend" tone="secondary" onPress={() => void mutateRelationship("send")} loading={relationshipBusy} /> : null}
        {!relationshipError && relationship === "outgoing_pending" ? <>
          <Text style={styles.body}>Request Sent</Text>
          <Button label="Cancel Request" tone="secondary" onPress={() => void mutateRelationship("cancel")} loading={relationshipBusy} />
        </> : null}
        {!relationshipError && relationship === "incoming_pending" ? <>
          <Button label="Accept Friend Request" tone="secondary" onPress={() => void mutateRelationship("accept")} loading={relationshipBusy} />
          <Button label="Decline" tone="secondary" onPress={() => void mutateRelationship("decline")} disabled={relationshipBusy} />
        </> : null}
        {!relationshipError && relationship === "friends" ? <>
          <Text style={styles.body}>Friends</Text>
          <Button label="Remove Friend" tone="danger" onPress={confirmRemoveFriend} disabled={relationshipBusy} />
        </> : null}
      </Card>
      <Card>
        <Button label="Block Player" tone="secondary" onPress={confirmBlock} loading={blockBusy} disabled={relationshipBusy} />
        {blockError ? <Text style={styles.body}>{blockError}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identityText: { flex: 1 },
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: "700" },
  heading: { color: colors.text, fontSize: typography.subheading, fontWeight: "700", marginBottom: spacing.sm },
  body: { color: colors.textMuted, marginTop: spacing.xs },
  sport: { marginTop: spacing.sm }
});
