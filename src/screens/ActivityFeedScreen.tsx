import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppStackParamList, MainTabParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { ActivityFeedItem } from "@/core/types/models";
import { getActivityFeedForProfile } from "@/services/activityService";
import { ActivityFeedCard } from "@/shared/components/ActivityFeedCard";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";
import { debugError, debugLog } from "@/shared/lib/logger";

type Props = BottomTabScreenProps<MainTabParamList, "ActivityFeed">;

export function ActivityFeedScreen({ navigation }: Props) {
  const { currentUser } = useAppState();
  const appNavigation = navigation.getParent<import("@react-navigation/native-stack").NativeStackNavigationProp<AppStackParamList>>();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    console.log("[ActivityFeedScreen] mounted", {
      profileId: currentUser?.id ?? null,
      timestamp: new Date().toISOString()
    });
    debugLog("[ActivityFeedScreen] mounted", {
      profileId: currentUser?.id ?? null
    });
  }, [currentUser?.id]);

  useEffect(() => {
    let isActive = true;

    async function loadFeed() {
      if (!currentUser?.id) {
        if (isActive) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        console.log("[ActivityFeedScreen] feed load started", {
          profileId: currentUser.id,
          reloadKey,
          timestamp: new Date().toISOString()
        });
        debugLog("[ActivityFeedScreen] loading feed", {
          profileId: currentUser.id,
          reloadKey
        });
        const feed = await getActivityFeedForProfile(currentUser.id);
        if (isActive) {
          debugLog("[ActivityFeedScreen] feed loaded", {
            profileId: currentUser.id,
            itemCount: feed.length
          });
          setItems(feed);
        }
      } catch (loadError) {
        if (isActive) {
          debugError("[ActivityFeedScreen] feed load failed", loadError, {
            profileId: currentUser.id,
            reloadKey
          });
          setItems([]);
          setError(
            loadError instanceof Error && loadError.message
              ? loadError.message
              : "Unable to load activity feed right now."
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadFeed();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, reloadKey]);

  return (
    <Screen>
      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading activity...</Text>
        </View>
      ) : error ? (
        <Card>
          <Text style={styles.errorTitle}>Could not load activity</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Button label="Try Again" onPress={() => setReloadKey((value) => value + 1)} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No recent activity yet"
            description="Create or accept a challenge to get your activity feed moving."
          />
          <Button label="Challenge a Player" onPress={() => appNavigation?.navigate("CreateChallenge")} />
        </Card>
      ) : (
        items.map((item) => <ActivityFeedCard key={item.id} item={item} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  stateText: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: typography.subheading
  }
});
