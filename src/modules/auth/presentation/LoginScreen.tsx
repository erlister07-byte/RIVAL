import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AuthStackParamList } from "@/application/navigation/types";
import { colors } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { Button } from "@/shared/components/Button";
import { getAuthErrorMessage, validateEmail } from "@/shared/lib/authValidation";
import { Input } from "@/shared/components/Input";
import { Screen } from "@/shared/components/Screen";
import { SectionTitle } from "@/shared/components/SectionTitle";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login, requestPasswordReset } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    const emailError = validateEmail(email);

    if (emailError) {
      setError(emailError);
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      await login({ email, password });
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError, "login"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const emailError = validateEmail(email);

    if (emailError) {
      setError(emailError);
      return;
    }

    setError("");
    setMessage("");
    setResetLoading(true);

    try {
      await requestPasswordReset(email);
      setMessage("If an account exists for that email, a reset link has been sent.");
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError, "reset"));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <Screen>
      <SectionTitle
        title="Log in"
        subtitle="Use your RIVAL account email and password."
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button label="Log In" onPress={handleSubmit} loading={loading} />
      <Button
        label="Reset Password"
        tone="secondary"
        onPress={handlePasswordReset}
        loading={resetLoading}
      />
      <Button label="Back to Welcome" tone="secondary" onPress={() => navigation.navigate("Welcome")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger
  },
  message: {
    color: colors.success
  }
});
