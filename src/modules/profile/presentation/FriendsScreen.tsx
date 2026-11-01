import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { useAppState } from "@/application/providers/AppProvider";
import { colors, spacing, typography } from "@/application/theme";
import { getFriends, SocialFriend } from "@/services/socialService";
import { Avatar } from "@/shared/components/Avatar";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "Friends">;

export function FriendsScreen({ navigation }: Props) {
  const { currentUser } = useAppState();
  const isFocused = useIsFocused();
  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    setState("loading");
    void getFriends().then((result) => {
      if (active) { setFriends(result); setState("ready"); }
    }).catch(() => {
      if (active) { setFriends([]); setState("error"); }
    });
    return () => { active = false; };
  }, [currentUser?.id, isFocused, reload]);

  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>Friends</Text>
        {state === "loading" ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading friends" /> : null}
        {state === "error" ? <>
          <Text style={styles.meta}>Unable to load friends right now.</Text>
          <Button label="Retry Friends" onPress={() => setReload((value) => value + 1)} />
        </> : null}
        {state === "ready" && friends.length === 0 ? <>
          <EmptyState title="No friends yet" description="Find players and add people you want to play again." />
          <Button label="Find Player" onPress={() => navigation.navigate("FriendSearch")} />
        </> : null}
        {state === "ready" ? friends.map(({ profile }) => (
          <Pressable
            key={profile.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${profile.displayName}'s profile`}
            onPress={() => navigation.navigate("OpponentProfile", { opponentProfileId: profile.id })}
            style={styles.row}
          >
            <Avatar username={profile.username} displayName={profile.displayName} size={48} />
            <View>
              <Text style={styles.name}>{profile.displayName}</Text>
              <Text style={styles.meta}>@{profile.username}</Text>
            </View>
          </Pressable>
        )) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: typography.subheading, fontWeight: "700", marginBottom: spacing.sm },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  name: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted }
});
