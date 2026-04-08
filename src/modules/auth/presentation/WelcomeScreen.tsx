import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";

import { AuthStackParamList } from "@/application/navigation/types";
import { colors, spacing } from "@/application/theme";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Screen } from "@/shared/components/Screen";
import { SectionTitle } from "@/shared/components/SectionTitle";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <SectionTitle
        eyebrow="Vancouver Layer 1"
        title="Challenge nearby athletes in the real world."
        subtitle="RIVAL is launching with pickleball in Vancouver first, with more sports already built into the roadmap."
      />

      <Card>
        <View style={styles.heroBlock}>
          <Text style={styles.heroNumber}>1</Text>
          <Text style={styles.heroText}>sports live at launch</Text>
        </View>
        <View style={styles.heroBlock}>
          <Text style={styles.heroNumber}>10 km</Text>
          <Text style={styles.heroText}>default discovery radius</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.listItem}>Round-based onboarding built for Vancouver players.</Text>
        <Text style={styles.listItem}>Nearby player discovery with fast sport and skill filters.</Text>
        <Text style={styles.listItem}>Challenge, accept, submit results, and confirm.</Text>
      </Card>

      <Button label="Create Account" onPress={() => navigation.navigate("SignUp")} />
      <Button label="Log In" tone="secondary" onPress={() => navigation.navigate("Login")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  heroNumber: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text
  },
  heroText: {
    color: colors.textMuted,
    fontWeight: "600"
  },
  listItem: {
    color: colors.text,
    lineHeight: 22
  }
});
