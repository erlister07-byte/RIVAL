import { StyleSheet, Text, ViewStyle } from "react-native";

import { colors, spacing, typography } from "@/application/theme";
import { Card } from "@/shared/components/Card";

type Props = {
  title: string;
  description?: string;
  style?: ViewStyle;
};

export function ResolvedStateCard({ title, description, style }: Props) {
  return (
    <Card style={StyleSheet.flatten([styles.card, style])}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.18)"
  },
  title: {
    color: colors.success,
    fontWeight: "800",
    fontSize: typography.bodyStrong
  },
  description: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: spacing.xxs
  }
});
