import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        style,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled
      ]}
    >
      {loading ? <ActivityIndicator color={colors.gray700} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    backgroundColor: colors.white,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.55
  },
  label: {
    color: colors.gray700,
    fontSize: typography.bodyStrong,
    fontWeight: "800",
    letterSpacing: 0.2
  }
});
