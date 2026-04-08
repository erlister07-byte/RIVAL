import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet } from "react-native";
import { Bell, Info, Mail } from "lucide-react-native";

import { colors } from "@/application/theme";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import { Header } from "@/components/ui/Header";
import { LoginScreen } from "@/modules/auth/presentation/LoginScreen";
import { SignUpScreen } from "@/modules/auth/presentation/SignUpScreen";
import { WelcomeScreen } from "@/modules/auth/presentation/WelcomeScreen";
import { CreateChallengeScreen } from "@/modules/challenges/presentation/CreateChallengeScreen";
import { ChallengeInboxScreen } from "@/modules/challenges/presentation/ChallengeInboxScreen";
import { NearbyPlayersScreen } from "@/modules/discovery/presentation/NearbyPlayersScreen";
import { HomeScreen } from "@/modules/home/presentation/HomeScreen";
import { OnboardingScreen } from "@/modules/onboarding/presentation/OnboardingScreen";
import { ProfileScreen } from "@/modules/profile/presentation/ProfileScreen";
import { ConfirmResultScreen } from "@/modules/results/presentation/ConfirmResultScreen";
import { MatchResultSubmissionScreen } from "@/modules/results/presentation/MatchResultSubmissionScreen";
import { ResultsInboxScreen } from "@/modules/results/presentation/ResultsInboxScreen";
import { ActivityFeedScreen } from "@/screens/ActivityFeedScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { FriendSearchScreen } from "@/screens/FriendSearchScreen";
import { LeaderboardScreen } from "@/screens/LeaderboardScreen";
import { MessagesScreen } from "@/screens/MessagesScreen";

import {
  AppStackParamList,
  AuthStackParamList,
  MainTabParamList,
  OnboardingStackParamList
} from "./types";
import { AuthGate } from "./AuthGate";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AppTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={({ navigation, route }) => {
        const titles: Record<keyof MainTabParamList, string> = {
          Home: "Home",
          ActivityFeed: "Activity",
          ChallengeInbox: "Challenges",
          Profile: "Profile"
        };
        const rightSlot =
          route.name === "Home" || route.name === "ChallengeInbox" ? (
            <Pressable
              onPress={() => navigation.getParent()?.navigate("Messages")}
              style={styles.headerIconButton}
            >
              <Mail size={20} color={colors.white} strokeWidth={2.2} />
            </Pressable>
          ) : route.name === "ActivityFeed" ? (
            <Pressable style={styles.headerIconButton}>
              <Bell size={20} color={colors.white} strokeWidth={2.2} />
            </Pressable>
          ) : undefined;

        return {
          headerShown: true,
          tabBarStyle: { display: "none" },
          header: () => <Header title={titles[route.name]} rightSlot={rightSlot} showBackButton={false} />
        };
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen
        name="ActivityFeed"
        component={ActivityFeedScreen}
        options={{ title: "Activity" }}
      />
      <Tabs.Screen
        name="ChallengeInbox"
        component={ChallengeInboxScreen}
        options={{ title: "Inbox" }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Onboarding" component={OnboardingScreen} />
    </OnboardingStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={({ navigation, route }) => {
        const titles: Partial<Record<keyof AppStackParamList | keyof MainTabParamList, string>> = {
          Home: "Home",
          ActivityFeed: "Activity",
          NearbyPlayers: "Nearby Players",
          ChallengeInbox: "Challenges",
          Profile: "Profile",
          FriendSearch: "Challenge Friend",
          Messages: "Messages",
          Chat: "Chat",
          Leaderboard: "Leaderboard",
          CreateChallenge: "Send Challenge",
          ResultsInbox: "Match Results",
          MatchResultSubmission: "Record Result",
          ConfirmResult: "Confirm Result",
          Tabs: "Home"
        };
        const shouldHideHeader = route.name === "Tabs";
        const rightSlot =
          route.name === "Chat" ? (
            <Pressable style={styles.headerIconButton}>
              <Info size={20} color={colors.white} strokeWidth={2.2} />
            </Pressable>
          ) : undefined;
        const title = titles[route.name] ?? "RIVAL";

        return {
          headerShown: !shouldHideHeader,
          headerShadowVisible: false,
          header: shouldHideHeader
            ? undefined
            : () => (
              <Header
                title={title}
                onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
                rightSlot={rightSlot}
                showBackButton={navigation.canGoBack()}
              />
            ),
          headerStyle: { backgroundColor: colors.primaryStart },
          headerTintColor: colors.white
        };
      }}
    >
      <AppStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <AppStack.Screen
        name="FriendSearch"
        component={FriendSearchScreen}
        options={{ title: "Challenge Friend" }}
      />
      <AppStack.Screen
        name="NearbyPlayers"
        component={NearbyPlayersScreen}
        options={{ title: "Nearby Players" }}
      />
      <AppStack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: "Messages" }}
      />
      <AppStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: "Chat" }}
      />
      <AppStack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: "Leaderboard" }}
      />
      <AppStack.Screen
        name="CreateChallenge"
        component={CreateChallengeScreen}
        options={{ title: "Send Challenge" }}
      />
      <AppStack.Screen
        name="ResultsInbox"
        component={ResultsInboxScreen}
        options={{ title: "Match Results" }}
      />
      <AppStack.Screen
        name="MatchResultSubmission"
        component={MatchResultSubmissionScreen}
        options={{ title: "Record Result" }}
      />
      <AppStack.Screen
        name="ConfirmResult"
        component={ConfirmResultScreen}
        options={{ title: "Confirm Result" }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  return (
    <AuthGate
      signedOut={<AuthNavigator />}
      onboarding={<OnboardingNavigator />}
      authenticated={<AppNavigator />}
    />
  );
}

const styles = StyleSheet.create({
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  }
});
