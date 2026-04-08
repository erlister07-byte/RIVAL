import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export function Chip({ label, selected = false, onPress, disabled = false }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <Text style={[styles.text, selected && styles.selectedText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.72
  },
  pressed: {
    opacity: 0.92
  },
  text: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.caption,
    letterSpacing: 0.2
  },
  selectedText: {
    color: colors.primary
  },
  disabledText: {
    color: colors.textMuted
  }
});
