import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { isBackendConfigured } from "@/application/config/runtimeConfig";
import { colors, navigationTheme, spacing } from "@/application/theme";

function DemoModeScreen() {
  return (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>RIVAL demo mode: backend not configured yet.</Text>
      <Text style={styles.demoSubtitle}>Disabled features:</Text>
      <View style={styles.demoList}>
        <Text style={styles.demoItem}>- auth disabled</Text>
        <Text style={styles.demoItem}>- live data disabled</Text>
        <Text style={styles.demoItem}>- challenges disabled</Text>
        <Text style={styles.demoItem}>- match history disabled</Text>
      </View>
    </View>
  );
}

export default function App() {
  if (!isBackendConfigured) {
    return (
      <SafeAreaProvider>
        <View style={styles.safeArea}>
          <StatusBar style="dark" />
          <DemoModeScreen />
        </View>
      </SafeAreaProvider>
    );
  }

  const { RootNavigator } = require("@/application/navigation/RootNavigator") as typeof import("@/application/navigation/RootNavigator");
  const { AppProvider } = require("@/application/providers/AppProvider") as typeof import("@/application/providers/AppProvider");

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  demoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  demoTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center"
  },
  demoSubtitle: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  demoList: {
    alignItems: "flex-start",
    gap: spacing.xs
  },
  demoItem: {
    color: colors.text,
    fontSize: 16
  }
});
