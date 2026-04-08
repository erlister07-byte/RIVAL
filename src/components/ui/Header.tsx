import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";

import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  title: string;
  onBackPress?: () => void;
  rightSlot?: ReactNode;
  showBackButton?: boolean;
};

const SIDE_ZONE_WIDTH = 168;

export function Header({ title, onBackPress, rightSlot, showBackButton = false }: Props) {
  return (
    <LinearGradient
      colors={[colors.primaryStart, colors.primaryEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.leading}>
        {showBackButton && onBackPress ? (
          <Pressable onPress={onBackPress} style={styles.iconButton}>
            <ChevronLeft size={22} color={colors.white} strokeWidth={2.4} />
          </Pressable>
        ) : <View style={styles.iconSpacer} />}
        <Text numberOfLines={1} style={styles.brand}>
          RIVAL
        </Text>
      </View>
      <View pointerEvents="none" style={styles.titleWrap}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </View>
      <View style={styles.trailing}>{rightSlot}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 104,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    position: "relative",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.14)"
  },
  leading: {
    width: SIDE_ZONE_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  titleWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: SIDE_ZONE_WIDTH,
    right: SIDE_ZONE_WIDTH,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center"
  },
  trailing: {
    width: SIDE_ZONE_WIDTH,
    justifyContent: "center",
    alignItems: "flex-end"
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4
  },
  iconSpacer: {
    width: 32,
    height: 36
  },
  brand: {
    color: colors.white,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 1.4
  },
  title: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center"
  }
});
