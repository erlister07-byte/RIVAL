import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { GradientButton } from "@/components/ui/GradientButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
};

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = "primary"
}: Props) {
  const isDisabled = disabled || loading;

  if (tone === "primary") {
    return (
      <GradientButton
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
      />
    );
  }

  if (tone === "secondary") {
    return (
      <SecondaryButton
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
      />
    );
  }

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        tone === "danger" && styles.danger,
        pressed && !isDisabled && styles.secondaryPressed,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={[styles.label, styles.dangerLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderWidth: 1
  },
  secondary: {
    backgroundColor: colors.white,
    borderColor: colors.gray200
  },
  danger: {
    backgroundColor: colors.error,
    borderColor: colors.error
  },
  secondaryPressed: {
    backgroundColor: colors.gray100
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.6
  },
  label: {
    color: colors.white,
    fontWeight: "700",
    fontSize: typography.bodyStrong,
    letterSpacing: 0.2
  },
  dangerLabel: {
    color: colors.white
  }
});
