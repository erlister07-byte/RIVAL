import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { spacing } from "@/application/theme";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "Messages">;

export function MessagesScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.container}>
        <EmptyState
          title="No messages yet"
          description="Messages will appear here when chat is available."
        />
        <Button label="Find Nearby Players" tone="secondary" onPress={() => navigation.navigate("NearbyPlayers")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm
  }
});
