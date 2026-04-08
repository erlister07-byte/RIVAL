import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/application/theme";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxxl,
    alignItems: "center",
    gap: spacing.sm
  },
  title: {
    fontWeight: "700",
    fontSize: typography.heading,
    color: colors.text
  },
  description: {
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 24
  }
});
