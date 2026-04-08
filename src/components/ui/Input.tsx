import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors, radius, spacing, typography } from "@/application/theme";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
} & Pick<
  TextInputProps,
  "autoCapitalize" | "autoCorrect" | "autoComplete" | "keyboardType" | "textContentType"
>;

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  autoCapitalize = "sentences",
  autoCorrect = true,
  autoComplete,
  keyboardType = "default",
  textContentType
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        textContentType={textContentType}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm
  },
  label: {
    color: colors.gray600,
    fontWeight: "700",
    fontSize: typography.overline,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    color: colors.gray700,
    fontSize: typography.bodyStrong
  },
  inputError: {
    borderColor: colors.error
  },
  error: {
    color: colors.error,
    fontSize: typography.caption
  }
});
