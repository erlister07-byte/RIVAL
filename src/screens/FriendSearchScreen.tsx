import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { spacing } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { DEFAULT_LAUNCH_SPORT, getSportIdBySlug } from "@/config/sports";
import { FriendSearchResult, searchProfilesByUsername } from "@/services/userService";
import { EmptyState } from "@/shared/components/EmptyState";
import { Input } from "@/shared/components/Input";
import { PlayerListItem } from "@/shared/components/PlayerListItem";
import { PlayerListSkeleton } from "@/shared/components/PlayerListSkeleton";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "FriendSearch">;

export function FriendSearchScreen({ navigation }: Props) {
  const { currentUser } = useAppState();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) {
      return undefined;
    }

    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      setError("");
      setResults([]);
      setHasSearched(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        setHasSearched(true);

        try {
          const nextResults = await searchProfilesByUsername(currentUser.id, normalizedQuery);
          setResults(nextResults);
        } catch (searchError) {
          setResults([]);
          setError(
            searchError instanceof Error && searchError.message
              ? searchError.message
              : "Unable to search players right now."
          );
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentUser?.id, query]);

  function renderItem({ item }: { item: FriendSearchResult }) {
    return (
      <PlayerListItem
        profileId={item.id}
        username={item.username}
        displayName={item.displayName}
        sportLabel={item.primarySport ?? DEFAULT_LAUNCH_SPORT}
        skillLevel={item.primarySkillLevel ?? "intermediate"}
        areaLabel={item.vancouverArea}
        availabilityStatus={item.availabilityStatus}
        playStyleTags={item.playStyleTags}
        matchesPlayed={item.matchesPlayed}
        onPress={() =>
          navigation.navigate({
            name: "CreateChallenge",
            params: {
              opponentId: item.id,
              opponentUsername: item.username,
              sportId: getSportIdBySlug(DEFAULT_LAUNCH_SPORT)
            },
            merge: true
          })
        }
      />
    );
  }

  return (
    <Screen scrollable={false}>
      <View style={styles.container}>
        <Input
          label="Find a Username"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username"
          error={error || undefined}
        />

        {loading ? (
          <PlayerListSkeleton count={2} />
        ) : !hasSearched ? (
          <EmptyState
            title="Challenge a friend by username"
            description="Type at least 2 characters to find a player and send a pickleball challenge fast."
          />
        ) : hasSearched && results.length === 0 && !error ? (
          <EmptyState
            title="No player found"
            description="Try the exact username or ask them to finish setting up their profile."
          />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl
  }
});
