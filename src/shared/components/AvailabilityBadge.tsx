import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";
import { AvailabilityStatus, getAvailabilityLabel } from "@/core/types/models";

type Props = {
  status: AvailabilityStatus;
};

function getTone(status: AvailabilityStatus) {
  switch (status) {
    case "now":
      return {
        backgroundColor: "#E8FFF1",
        borderColor: "#7AD7A0",
        color: "#137A46"
      };
    case "today":
      return {
        backgroundColor: "#EEF6FF",
        borderColor: "#9FC4F8",
        color: colors.primary
      };
    case "this_week":
      return {
        backgroundColor: "#FFF8E8",
        borderColor: "#F1D08B",
        color: "#8A5A00"
      };
    case "unavailable":
    default:
      return {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        color: colors.textMuted
      };
  }
}

export function AvailabilityBadge({ status }: Props) {
  const tone = getTone(status);

  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
      <Text style={[styles.label, { color: tone.color }]}>{getAvailabilityLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start"
  },
  label: {
    fontSize: typography.caption,
    fontWeight: "700"
  }
});
