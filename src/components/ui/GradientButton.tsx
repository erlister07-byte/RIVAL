import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  leftSlot?: ReactNode;
};

export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  leftSlot
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        style,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled
      ]}
    >
      <LinearGradient
        colors={[colors.primaryStart, colors.primaryEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            {leftSlot}
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 56,
    borderRadius: radius.lg,
    overflow: "hidden"
  },
  gradient: {
    minHeight: 56,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.55
  },
  label: {
    color: colors.white,
    fontSize: typography.bodyStrong,
    fontWeight: "700",
    letterSpacing: 0.2
  }
});
