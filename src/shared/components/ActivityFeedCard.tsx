import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/application/theme";
import { ActivityFeedItem } from "@/core/types/models";
import { Card } from "@/shared/components/Card";
import { formatDateTime } from "@/shared/lib/format";

type ActivityFeedCardProps = {
  item: ActivityFeedItem;
};

export function ActivityFeedCard({ item }: ActivityFeedCardProps) {
  const meta = [item.sportLabel, formatDateTime(item.createdAt)].filter(Boolean).join(" · ");
  const headerLabel = item.title ?? item.actorDisplayName;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.actor}>{headerLabel}</Text>
        <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      {item.sportLabel ? <Text style={styles.meta}>{meta}</Text> : null}
      {item.score ? <Text style={styles.detail}>Result: {item.score}</Text> : null}
      {item.locationName ? <Text style={styles.detail}>{item.locationName}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  actor: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.subheading,
    flex: 1
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  message: {
    color: colors.text,
    lineHeight: 24
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20
  },
  detail: {
    color: colors.textMuted,
    lineHeight: 20
  }
});
