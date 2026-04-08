import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";
import { AvailabilityStatus, PlayStyleTag, getPlayStyleTagLabel } from "@/core/types/models";
import { Button } from "@/shared/components/Button";
import { Avatar } from "@/shared/components/Avatar";
import { AvailabilityBadge } from "@/shared/components/AvailabilityBadge";
import { Card } from "@/shared/components/Card";

type Props = {
  profileId?: string;
  username: string;
  displayName?: string;
  decisionText?: string;
  secondaryTextOverride?: string;
  sportLabel?: string;
  skillLevel?: string;
  areaLabel?: string;
  distanceLabel?: string;
  availabilityStatus?: AvailabilityStatus;
  playStyleTags?: PlayStyleTag[];
  matchesPlayed?: number;
  reason?: string;
  actionLabel?: string;
  onPress: () => void;
};

export function PlayerListItem({
  profileId,
  username,
  displayName,
  decisionText,
  secondaryTextOverride,
  sportLabel,
  skillLevel,
  areaLabel,
  distanceLabel,
  availabilityStatus,
  playStyleTags = [],
  matchesPlayed,
  reason,
  actionLabel = "Challenge",
  onPress
}: Props) {
  const locationLabel = distanceLabel ?? areaLabel;
  const detailBits = [sportLabel, skillLevel, locationLabel].filter(Boolean);
  const secondaryText = secondaryTextOverride ?? (detailBits.length > 0 ? detailBits.join(" · ") : null);
  const visiblePlayStyleTags = playStyleTags.slice(0, 2);
  const hiddenPlayStyleTagCount = Math.max(0, playStyleTags.length - visiblePlayStyleTags.length);

  return (
    <Card style={styles.card}>
      <Avatar profileId={profileId} username={username} displayName={displayName} size={40} />
      <View style={styles.content}>
        <Text style={styles.username}>{username}</Text>
        {displayName && displayName !== username ? <Text style={styles.displayName}>{displayName}</Text> : null}
        {decisionText ? <Text style={styles.decisionText}>{decisionText}</Text> : null}
        {visiblePlayStyleTags.length > 0 ? (
          <View style={styles.playStyleRow}>
            {visiblePlayStyleTags.map((tag) => (
              <Text key={tag} style={styles.playStyleTag}>
                {getPlayStyleTagLabel(tag)}
              </Text>
            ))}
            {hiddenPlayStyleTagCount > 0 ? (
              <Text style={styles.playStyleTag}>+{hiddenPlayStyleTagCount}</Text>
            ) : null}
          </View>
        ) : null}
        {secondaryText ? <Text style={styles.secondaryText}>{secondaryText}</Text> : null}
        <View style={styles.metaRow}>
          {availabilityStatus ? <AvailabilityBadge status={availabilityStatus} /> : null}
          {typeof matchesPlayed === "number" ? (
            <Text style={styles.metaText}>
              {matchesPlayed} {matchesPlayed === 1 ? "match" : "matches"}
            </Text>
          ) : null}
        </View>
        {reason ? <Text style={styles.reasonText}>{reason}</Text> : null}
      </View>
      <View style={styles.actionWrap}>
        <Button label={actionLabel} onPress={onPress} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  content: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.xxs
  },
  username: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "700"
  },
  displayName: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  decisionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  playStyleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  playStyleTag: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  reasonText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  actionWrap: {
    minWidth: 124,
    paddingTop: spacing.xxs
  }
});
