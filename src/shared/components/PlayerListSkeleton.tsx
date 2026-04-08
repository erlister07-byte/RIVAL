import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/application/theme";
import { Card } from "@/shared/components/Card";

type Props = {
  count?: number;
};

export function PlayerListSkeleton({ count = 3 }: Props) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} style={styles.card}>
          <View style={styles.avatar} />
          <View style={styles.content}>
            <View style={styles.primaryLine} />
            <View style={styles.secondaryLine} />
          </View>
          <View style={styles.buttonStub} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  content: {
    flex: 1,
    gap: spacing.xs
  },
  primaryLine: {
    width: "58%",
    height: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted
  },
  secondaryLine: {
    width: "36%",
    height: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.gray200
  },
  buttonStub: {
    width: 112,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted
  }
});
