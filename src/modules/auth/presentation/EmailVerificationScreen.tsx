import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/application/providers/AppProvider";
import { colors, spacing, typography } from "@/application/theme";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

export function EmailVerificationScreen() {
  const { authUser, resendVerificationEmail, refreshAuthUser, logout } = useAppState();
  const [loadingAction, setLoadingAction] = useState<"resend" | "refresh" | "logout" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [resendCooldownSeconds]);

  async function handleResend() {
    if (resendCooldownSeconds > 0) {
      return;
    }

    setLoadingAction("resend");
    setError("");
    setMessage("");

    try {
      await resendVerificationEmail();
      setResendCooldownSeconds(60);
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error && verificationError.message
          ? verificationError.message
          : "Unable to resend verification email."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRefresh() {
    setLoadingAction("refresh");
    setError("");
    setMessage("");

    try {
      await refreshAuthUser();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error && refreshError.message
          ? refreshError.message
          : "Unable to refresh your account status."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleLogout() {
    setLoadingAction("logout");
    setError("");
    setMessage("");

    try {
      await logout();
    } catch (logoutError) {
      setError(
        logoutError instanceof Error && logoutError.message
          ? logoutError.message
          : "Unable to log out right now."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  const resendLabel =
    resendCooldownSeconds > 0
      ? `Resend in ${resendCooldownSeconds}s`
      : "Resend Verification Email";

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>
          Verify <Text style={styles.strong}>{authUser?.email ?? "your email"}</Text> before
          continuing into RIVAL.
        </Text>
        <Text style={styles.secondary}>
          Once you click the verification link in your inbox, return here and tap Check Again.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      <Button
        label={resendLabel}
        onPress={handleResend}
        loading={loadingAction === "resend"}
        disabled={Boolean(loadingAction) || resendCooldownSeconds > 0}
      />
      {resendCooldownSeconds > 0 ? (
        <Text style={styles.cooldown}>You can resend another verification email in {resendCooldownSeconds}s.</Text>
      ) : null}
      <Button
        label="Check Again"
        tone="secondary"
        onPress={handleRefresh}
        loading={loadingAction === "refresh"}
        disabled={Boolean(loadingAction)}
      />
      <Button
        label="Log Out"
        tone="secondary"
        onPress={handleLogout}
        loading={loadingAction === "logout"}
        disabled={Boolean(loadingAction)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "700"
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24
  },
  secondary: {
    color: colors.textMuted,
    fontSize: typography.body
  },
  strong: {
    fontWeight: "700"
  },
  error: {
    color: colors.danger,
    fontWeight: "600"
  },
  message: {
    color: colors.success,
    fontWeight: "600"
  },
  cooldown: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center"
  }
});
