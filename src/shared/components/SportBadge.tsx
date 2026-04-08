import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/application/theme";
import { SportSlug } from "@/core/types/models";

import { SportIcon } from "./SportIcon";

type Props = {
  sport: SportSlug;
  size?: "small" | "medium" | "large";
  selected?: boolean;
  isSelected?: boolean;
  isEnabled?: boolean;
};

const SIZE_MAP = {
  small: {
    container: 28,
    icon: 20,
    radius: 10
  },
  medium: {
    container: 40,
    icon: 24,
    radius: 12
  },
  large: {
    container: 48,
    icon: 28,
    radius: 14
  }
} as const;

export function SportBadge({
  sport,
  size = "medium",
  selected = false,
  isSelected,
  isEnabled = true
}: Props) {
  const metrics = SIZE_MAP[size];
  const isActiveSelection = isSelected ?? selected;
  const iconColor = isEnabled ? colors.white : "rgba(255,255,255,0.62)";

  return (
    <View
      style={[
        styles.base,
        {
          width: metrics.container,
          height: metrics.container,
          borderRadius: metrics.radius
        },
        isActiveSelection ? styles.selected : isEnabled ? styles.enabled : styles.disabled
      ]}
    >
      <SportIcon
        sport={sport}
        size={metrics.icon}
        color={iconColor}
        strokeWidth={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  enabled: {
    backgroundColor: colors.gray700,
    borderColor: "rgba(6,182,212,0.34)",
    shadowColor: colors.primaryEnd,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3
    },
    elevation: 1
  },
  disabled: {
    backgroundColor: colors.gray600,
    borderColor: "rgba(255,255,255,0.05)",
    opacity: 0.66
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryEnd,
    shadowColor: colors.primaryEnd,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  }
});
