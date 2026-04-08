import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, House, Mail, Plus, User } from "lucide-react-native";
import { useEffect, useState } from "react";

import { colors, radius, spacing, typography } from "@/application/theme";
import { MainTabParamList } from "@/application/navigation/types";
import { useAppState } from "@/application/providers/AppProvider";
import { getChallengeInboxActivitySummary, subscribeToChallengeActivity } from "@/services/challengeService";
import { getChallengeInboxLastViewedAt } from "@/services/challengeInboxActivityStore";
import { debugError } from "@/shared/lib/logger";

type TabDefinition = {
  key: "Home" | "Challenges" | "Create" | "Activity" | "Profile";
  label: string;
  icon: "house" | "mail" | "plus" | "activity" | "user";
  routeName?: keyof MainTabParamList;
};

const tabs: TabDefinition[] = [
  { key: "Home", label: "Home", icon: "house", routeName: "Home" },
  { key: "Challenges", label: "Challenges", icon: "mail", routeName: "ChallengeInbox" },
  { key: "Create", label: "Create", icon: "plus" },
  { key: "Activity", label: "Activity", icon: "activity", routeName: "ActivityFeed" },
  { key: "Profile", label: "Profile", icon: "user", routeName: "Profile" }
];

function TabIcon({ icon, color }: { icon: TabDefinition["icon"]; color: string }) {
  const size = 20;
  switch (icon) {
    case "house":
      return <House size={size} color={color} strokeWidth={2.2} />;
    case "mail":
      return <Mail size={size} color={color} strokeWidth={2.2} />;
    case "plus":
      return <Plus size={size} color={color} strokeWidth={2.2} />;
    case "activity":
      return <Activity size={size} color={color} strokeWidth={2.2} />;
    case "user":
      return <User size={size} color={color} strokeWidth={2.2} />;
  }
}

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const { currentUser } = useAppState();
  const currentRouteName = state.routes[state.index]?.name as keyof MainTabParamList;
  const [newChallengeActivityCount, setNewChallengeActivityCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadChallengeActivityCount() {
      if (!currentUser?.id) {
        if (isActive) {
          setNewChallengeActivityCount(0);
        }
        return;
      }

      try {
        const lastViewedAt = await getChallengeInboxLastViewedAt(currentUser.id);
        const summary = await getChallengeInboxActivitySummary(currentUser.id, lastViewedAt);

        if (isActive) {
          setNewChallengeActivityCount(summary.totalCount);
        }
      } catch (error) {
        debugError("[BottomTabBar] failed to load challenge inbox activity count", error, {
          profileId: currentUser.id
        });

        if (isActive) {
          setNewChallengeActivityCount(0);
        }
      }
    }

    void loadChallengeActivityCount();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadChallengeActivityCount();
      }
    });

    const realtimeChannel = currentUser?.id
      ? subscribeToChallengeActivity(currentUser.id, () => {
          void loadChallengeActivityCount();
        })
      : null;

    return () => {
      isActive = false;
      subscription.remove();
      if (realtimeChannel) {
        void realtimeChannel.unsubscribe();
      }
    };
  }, [currentRouteName, currentUser?.id]);

  return (
    <View style={styles.outer}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = tab.routeName ? currentRouteName === tab.routeName : false;

          const content = (
            <>
              <View style={styles.iconWrap}>
                <TabIcon icon={tab.icon} color={active || tab.key === "Create" ? colors.white : colors.gray400} />
                {tab.key === "Challenges" && currentRouteName !== "ChallengeInbox" && newChallengeActivityCount > 0 ? (
                  <View style={[styles.badge, active ? styles.badgeActive : null]}>
                    <Text style={styles.badgeText}>{newChallengeActivityCount > 9 ? "9+" : newChallengeActivityCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, active && styles.activeLabel, tab.key === "Create" && styles.createLabel]}>
                {tab.label}
              </Text>
            </>
          );

          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                if (tab.key === "Create") {
                  navigation.getParent()?.navigate("CreateChallenge");
                  return;
                }

                if (tab.routeName) {
                  navigation.navigate(tab.routeName);
                }
              }}
              style={styles.item}
            >
              {active || tab.key === "Create" ? (
                <LinearGradient
                  colors={[colors.primaryStart, colors.primaryEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.activePill, tab.key === "Create" && styles.createPill]}
                >
                  {content}
                </LinearGradient>
              ) : (
                <View style={styles.inactivePill}>{content}</View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    backgroundColor: "transparent"
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: {
      width: 0,
      height: 10
    }
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  inactivePill: {
    minHeight: 54,
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg
  },
  activePill: {
    minHeight: 54,
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    shadowColor: colors.primaryEnd,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6
    }
  },
  createPill: {
    minWidth: 64
  },
  label: {
    color: colors.gray400,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
    lineHeight: 14
  },
  activeLabel: {
    color: colors.white
  },
  createLabel: {
    color: colors.white,
    fontSize: typography.caption
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white
  },
  badgeActive: {
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800"
  }
});
