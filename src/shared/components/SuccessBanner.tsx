import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, spacing, typography } from "@/application/theme";
import { Card } from "@/shared/components/Card";

type Props = {
  title: string;
  hint?: string;
  style?: ViewStyle;
  onDismiss?: () => void;
};

export function SuccessBanner({ title, hint, style, onDismiss }: Props) {
  return (
    <Card style={StyleSheet.flatten([styles.banner, style])}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.18)"
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  copy: {
    flex: 1
  },
  title: {
    color: colors.success,
    fontWeight: "800",
    fontSize: typography.bodyStrong
  },
  hint: {
    color: colors.text,
    lineHeight: 21,
    marginTop: spacing.xxs
  },
  dismissButton: {
    paddingVertical: spacing.xxs
  },
  dismissText: {
    color: colors.success,
    fontSize: typography.caption,
    fontWeight: "700"
  }
});
