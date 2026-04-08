import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "Chat">;

export function ChatScreen({ route }: Props) {
  return (
    <Screen scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>{route.params.opponentName || "Messages"}</Text>
        <EmptyState
          title="No messages yet"
          description="Chat isn't live in beta yet. Challenge players first and this screen will come to life later."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700"
  }
});
