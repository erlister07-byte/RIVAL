import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, radius, shadows, spacing } from "@/application/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

export function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 22,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...shadows.card
  }
});
