import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  label: string;
  tone?: "default" | "success" | "warning" | "error";
};

export function Badge({ label, tone = "default" }: Props) {
  return (
    <View
      style={[
        styles.base,
        tone === "success" && styles.success,
        tone === "warning" && styles.warning,
        tone === "error" && styles.error
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === "success" && styles.successLabel,
          tone === "warning" && styles.warningLabel,
          tone === "error" && styles.errorLabel
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.05)"
  },
  success: {
    backgroundColor: "#ECFDF5"
  },
  warning: {
    backgroundColor: "#FFFBEB"
  },
  error: {
    backgroundColor: "#FEF2F2"
  },
  label: {
    color: colors.gray600,
    fontSize: typography.caption,
    fontWeight: "800",
    letterSpacing: 0.3
  },
  successLabel: {
    color: colors.success
  },
  warningLabel: {
    color: colors.warning
  },
  errorLabel: {
    color: colors.error
  }
});
