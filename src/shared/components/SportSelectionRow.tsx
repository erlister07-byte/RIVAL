import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { colors, radius, spacing, typography } from "@/application/theme";
import { SportSlug } from "@/core/types/models";
import { Badge } from "@/components/ui/Badge";

import { SportBadge } from "./SportBadge";

type Props = {
  sport: SportSlug;
  label: string;
  meta?: string;
  selected?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  isEnabled?: boolean;
  onPress?: () => void;
  showLiveBadge?: boolean;
};

const ROW_GAP = 12;

export function SportSelectionRow({
  sport,
  label,
  meta,
  selected = false,
  isSelected,
  disabled = false,
  isEnabled,
  onPress,
  showLiveBadge = false
}: Props) {
  const enabled = isEnabled ?? !disabled;
  const activeSelection = isSelected ?? selected;

  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        enabled ? styles.enabledRow : styles.disabledRow,
        activeSelection && styles.selectedRow,
        pressed && enabled ? styles.pressedRow : null
      ]}
    >
      <SportBadge sport={sport} size="medium" isSelected={activeSelection} isEnabled={enabled} />

      <View style={styles.content}>
        <Text style={[styles.label, enabled ? styles.enabledLabel : styles.disabledLabel]}>{label}</Text>
        {meta ? <Text style={[styles.meta, !enabled ? styles.disabledMeta : null]}>{meta}</Text> : null}
      </View>

      <View style={styles.trailing}>
        {activeSelection ? (
          <View style={styles.checkWrap}>
            <Check size={18} color={colors.primary} strokeWidth={2.6} />
          </View>
        ) : !enabled ? (
          <Badge label="Coming Soon" tone="default" />
        ) : showLiveBadge ? (
          <Badge label="Live" tone="success" />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  enabledRow: {
    borderColor: "rgba(6,182,212,0.28)",
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.primaryEnd,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 1
  },
  selectedRow: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6
    },
    elevation: 2
  },
  disabledRow: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.62
  },
  pressedRow: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }]
  },
  content: {
    flex: 1,
    gap: spacing.xxs
  },
  label: {
    fontSize: typography.bodyStrong,
    fontWeight: "600"
  },
  enabledLabel: {
    color: colors.primary
  },
  disabledLabel: {
    color: colors.textMuted
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  disabledMeta: {
    color: colors.gray400
  },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 88
  },
  checkWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary
  }
});
