import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AuthStackParamList } from "@/application/navigation/types";
import { colors } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { Button } from "@/shared/components/Button";
import { getAuthErrorMessage, validateEmail, validatePassword } from "@/shared/lib/authValidation";
import { Input } from "@/shared/components/Input";
import { Screen } from "@/shared/components/Screen";
import { SectionTitle } from "@/shared/components/SectionTitle";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      await signUp({ email, password });
      setMessage("Account created. Check your inbox to verify your email.");
    } catch (signUpError) {
      setError(getAuthErrorMessage(signUpError, "signup"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SectionTitle
        title="Create your RIVAL account"
        subtitle="Use a real email so you can verify your account and reset your password."
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
        placeholder="At least 8 characters with a number"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button label="Sign Up" onPress={handleSubmit} loading={loading} />
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
