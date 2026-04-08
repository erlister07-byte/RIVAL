import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/application/providers/AppProvider";
import { colors, spacing } from "@/application/theme";
import { EmailVerificationScreen } from "@/modules/auth/presentation/EmailVerificationScreen";

type Props = {
  signedOut: React.ReactNode;
  onboarding: React.ReactNode;
  authenticated: React.ReactNode;
};

export function AuthGate({ signedOut, onboarding, authenticated }: Props) {
  const { sessionStatus } = useAppState();

  if (sessionStatus === "booting") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading RIVAL...</Text>
      </View>
    );
  }

  if (sessionStatus === "signed_out") {
    return <>{signedOut}</>;
  }

  if (sessionStatus === "needs_verification") {
    return <EmailVerificationScreen />;
  }

  if (sessionStatus === "needs_onboarding") {
    return <>{onboarding}</>;
  }

  return <>{authenticated}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.background
  },
  loadingText: {
    color: colors.textMuted
  }
});
