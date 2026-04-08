import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/application/theme";

export function SectionTitle({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm
  },
  eyebrow: {
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: "700",
    fontSize: typography.overline
  },
  title: {
    fontSize: typography.hero,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.text
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.bodyStrong,
    lineHeight: 24,
    maxWidth: 340
  }
});
