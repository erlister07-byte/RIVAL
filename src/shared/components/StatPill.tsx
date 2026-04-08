import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";

export function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 104
  },
  value: {
    fontSize: typography.heading,
    fontWeight: "800",
    color: colors.text
  },
  label: {
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    fontSize: typography.overline,
    letterSpacing: 0.8
  }
});
