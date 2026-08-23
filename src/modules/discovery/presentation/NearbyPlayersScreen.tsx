import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import {
  AppStackParamList,
  LoopOneStackParamList,
  LoopTwoStackParamList,
  NearbyPlayersRouteParams
} from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { DEFAULT_LAUNCH_SPORT, getEnabledSportConfigs, getSportIdBySlug } from "@/config/sports";
import {
  AvailabilityStatus,
  getAvailabilityLabel,
  getChallengeTypeLabel,
  getStakeDisplay,
  OpenChallenge
} from "@/core/types/models";
import {
  acceptLoopTwoOpenChallenge,
  acceptOpenChallenge,
  cancelLoopTwoOpenChallenge,
  getLoopTwoOpenChallenges,
  getOpenChallenges
} from "@/services/challengeService";
import { NearbyPlayer, getLoopOneNearbyPlayers, getNearbyPlayers } from "@/services/playerService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { PlayerListItem } from "@/shared/components/PlayerListItem";
import { PlayerListSkeleton } from "@/shared/components/PlayerListSkeleton";
import { Screen } from "@/shared/components/Screen";
import { formatDateTime } from "@/shared/lib/format";
import { getDiagnosticErrorMessage, getUserSafeErrorMessage } from "@/shared/lib/serviceError";

type Props = NativeStackScreenProps<AppStackParamList, "NearbyPlayers">;
type LoopOneProps = NativeStackScreenProps<LoopOneStackParamList, "NearbyPlayers">;
type LoopTwoProps = NativeStackScreenProps<LoopTwoStackParamList, "NearbyPlayers">;

type NearbyPlayersContentProps = {
  routeParams: NearbyPlayersRouteParams;
  sandboxMode: "loop-01" | "loop-02" | null;
  onCreateChallenge?: (params: NonNullable<AppStackParamList["CreateChallenge"]>) => void;
  onNavigateToPendingChallenges?: () => void;
  onNavigateToMatches?: () => void;
  onNavigateToOpenChallenges?: () => void;
  onNavigateToFriendSearch?: () => void;
  onOpenChallengeAccepted?: () => void;
};

const timingOptions: AvailabilityStatus[] = ["now", "today", "this_week"];

export function FullNearbyPlayersScreen({ navigation, route }: Props) {
  return (
    <NearbyPlayersContent
      routeParams={route.params}
      sandboxMode={null}
      onCreateChallenge={(params) => navigation.navigate("CreateChallenge", params)}
      onNavigateToFriendSearch={() => navigation.navigate("FriendSearch")}
      onOpenChallengeAccepted={() =>
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Tabs",
              state: {
                index: 2,
                routes: [{ name: "Home" }, { name: "ActivityFeed" }, { name: "ChallengeInbox" }]
              }
            }
          ]
        })
      }
    />
  );
}

export function LoopOneNearbyPlayersScreen({ route }: LoopOneProps) {
  return <NearbyPlayersContent routeParams={route.params} sandboxMode="loop-01" />;
}

export function LoopTwoNearbyPlayersScreen({ navigation, route }: LoopTwoProps) {
  return (
    <NearbyPlayersContent
      routeParams={route.params}
      sandboxMode="loop-02"
      onCreateChallenge={(params) => navigation.navigate("CreateChallenge", params)}
      onNavigateToPendingChallenges={() => navigation.navigate("ChallengeInbox")}
      onNavigateToMatches={() => navigation.navigate("MatchInbox")}
      onNavigateToOpenChallenges={() => navigation.navigate("NearbyPlayers", { mode: "play_now" })}
      onOpenChallengeAccepted={() => navigation.navigate("MatchInbox")}
    />
  );
}

function NearbyPlayersContent({
  routeParams,
  sandboxMode,
  onCreateChallenge,
  onNavigateToPendingChallenges,
  onNavigateToMatches,
  onNavigateToOpenChallenges,
  onNavigateToFriendSearch,
  onOpenChallengeAccepted
}: NearbyPlayersContentProps) {
  const { currentUser, isHydratingProfile } = useAppState();
  const enabledSports = getEnabledSportConfigs();
  const isPlayNowMode = routeParams?.mode === "play_now" && (sandboxMode === null || sandboxMode === "loop-02");
  const [sport, setSport] = useState(routeParams?.sport ?? DEFAULT_LAUNCH_SPORT);
  const [timingContext, setTimingContext] = useState<AvailabilityStatus>(routeParams?.availability ?? "today");
  const [players, setPlayers] = useState<NearbyPlayer[]>([]);
  const [openChallenges, setOpenChallenges] = useState<OpenChallenge[]>([]);
  const [ownOpenChallenges, setOwnOpenChallenges] = useState<OpenChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [joiningChallengeId, setJoiningChallengeId] = useState<string | null>(null);
  const [cancelingChallengeId, setCancelingChallengeId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<NearbyPlayer | null>(null);

  if (!currentUser?.id && isHydratingProfile) {
    return (
      <Screen scrollable={false}>
        <View style={styles.container}>
          <Card>
            <Text style={styles.errorTitle}>Loading your player profile</Text>
            <Text style={styles.stateText}>Nearby matches will appear once your profile finishes hydrating.</Text>
          </Card>
          <PlayerListSkeleton />
        </View>
      </Screen>
    );
  }

  useEffect(() => {
    let isActive = true;

    async function loadPlayers() {
      if (!currentUser?.id) {
        if (isActive) {
          setPlayers([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");
      setActionError("");

      try {
        if (isPlayNowMode) {
          const loopTwoChallenges = sandboxMode === "loop-02"
            ? await getLoopTwoOpenChallenges(sport)
            : null;
          const nextChallenges = loopTwoChallenges?.challenges ?? await getOpenChallenges(
            currentUser.id,
            getSportIdBySlug(sport),
            currentUser.vancouverArea
          );

          if (isActive) {
            setOpenChallenges(nextChallenges);
            setOwnOpenChallenges(loopTwoChallenges?.ownChallenges ?? []);
            setPlayers([]);
          }
        } else {
          const nextPlayers = sandboxMode
            ? await getLoopOneNearbyPlayers({ sport, availability: timingContext })
            : await getNearbyPlayers(currentUser.id, {
                sport,
                maxDistanceKm: currentUser.challengeRadiusKm,
                availability: timingContext
              });

          if (isActive) {
            setPlayers(nextPlayers);
            setOpenChallenges([]);
            setOwnOpenChallenges([]);
          }
        }
      } catch (loadError) {
        if (isActive) {
          setPlayers([]);
          setOpenChallenges([]);
          setOwnOpenChallenges([]);
          setError(
            loadError instanceof Error && loadError.message
              ? loadError.message
              : isPlayNowMode
                ? "Unable to load Quick Match right now."
                : "Unable to load nearby players right now."
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadPlayers();

    return () => {
      isActive = false;
    };
  }, [currentUser?.challengeRadiusKm, currentUser?.id, currentUser?.vancouverArea, isPlayNowMode, reloadKey, sport, timingContext]);

  const headerTitle = isPlayNowMode
    ? "Find a live game"
    : sandboxMode
      ? "Find someone nearby"
      : "Find someone nearby and start a match";
  const headerSubtitle =
    isPlayNowMode
      ? "Join nearby open challenges that are ready for another player."
      : sandboxMode
        ? "Nearby players filtered by the sport you play and when you want to play."
        : "Nearby opponents filtered by the sport you play and when you want to get on court.";

  const emptyDescription = useMemo(() => {
    if (isPlayNowMode) {
      return "Be the first to play — post an open challenge";
    }

    if (timingContext === "now") {
      return sandboxMode
        ? "No one nearby is marked ready now. Try today or this week."
        : "No one nearby is marked ready now. Try today or this week, or challenge a friend directly.";
    }

    if (timingContext === "today") {
      return sandboxMode
        ? "No one nearby is free today. Try widening the timing to this week."
        : "No one nearby is free today. Try widening the timing to this week or challenge a friend.";
    }

    return sandboxMode
      ? "No nearby players matched this timing yet. Try again later."
      : "No nearby players matched this timing yet. Try again later or challenge a friend by username.";
  }, [isPlayNowMode, sandboxMode, timingContext]);

  async function handleJoinOpenChallenge(challenge: OpenChallenge) {
    if (!currentUser?.id) {
      setActionError("You need to be signed in to join a challenge.");
      return;
    }

    setJoiningChallengeId(challenge.id);
    setActionError("");

    try {
      if (sandboxMode === "loop-02") {
        await acceptLoopTwoOpenChallenge(challenge.id);
      } else {
        await acceptOpenChallenge(challenge.id, currentUser.id);
      }
      setOpenChallenges((current) => current.filter((item) => item.id !== challenge.id));
      onOpenChallengeAccepted?.();
    } catch (joinError) {
      setActionError(getUserSafeErrorMessage(joinError, "Unable to join this challenge right now."));
    } finally {
      setJoiningChallengeId(null);
    }
  }

  async function handleCancelOpenChallenge(challenge: OpenChallenge) {
    if (sandboxMode !== "loop-02") return;

    setCancelingChallengeId(challenge.id);
    setActionError("");

    try {
      await cancelLoopTwoOpenChallenge(challenge.id);
      setOwnOpenChallenges((current) => current.filter((item) => item.id !== challenge.id));
    } catch (cancelError) {
      setActionError(getUserSafeErrorMessage(cancelError, "Unable to cancel this open challenge right now."));
    } finally {
      setCancelingChallengeId(null);
    }
  }

  function renderPlayer({ item }: { item: NearbyPlayer }) {
    const sportProfile = item.sports.find((entry) => entry.sport === sport) ?? item.sports[0];

    return (
      <PlayerListItem
        profileId={item.id}
        username={item.username}
        displayName={item.displayName}
        sportLabel={sportProfile?.sport ?? sport}
        skillLevel={sportProfile?.skillLevel}
        distanceLabel={`${item.distanceKm.toFixed(1)} km away`}
        availabilityStatus={item.availabilityStatus}
        playStyleTags={item.playStyleTags}
        matchesPlayed={item.matchesPlayed}
        reason={`${item.vancouverArea} · ${getAvailabilityLabel(item.availabilityStatus)}`}
        actionLabel={sandboxMode ? "Select" : "Challenge"}
        onPress={() => {
          if (sandboxMode) {
            setSelectedPlayer(item);
            return;
          }

          onCreateChallenge?.({
            opponentId: item.id,
            opponentUsername: item.username,
            sportId: getSportIdBySlug(sport),
            timingContext
          });
        }}
      />
    );
  }

  function renderOpenChallenge({ item }: { item: OpenChallenge }) {
    return (
      <Card>
        <Text style={styles.playerName}>{item.challengerUsername}</Text>
        {item.challengerDisplayName && item.challengerDisplayName !== item.challengerUsername ? (
          <Text style={styles.displayName}>{item.challengerDisplayName}</Text>
        ) : null}
        <Text style={styles.meta}>
          {item.sportName} · {getChallengeTypeLabel(item.challengeType)} · {getStakeDisplay(item.stakeType, item.stakeLabel)}
        </Text>
        <Text style={styles.meta}>{formatDateTime(item.scheduledAt)}</Text>
        <Text style={styles.meta}>{item.locationName} · {item.challengerArea}</Text>
        {typeof item.matchesPlayed === "number" ? (
          <Text style={styles.reasonText}>
            {item.matchesPlayed} {item.matchesPlayed === 1 ? "match" : "matches"} played
          </Text>
        ) : null}
        {item.stakeNote ? <Text style={styles.note}>{item.stakeNote}</Text> : null}
        <Button
          label="Join Game"
          onPress={() => void handleJoinOpenChallenge(item)}
          loading={joiningChallengeId === item.id}
          disabled={Boolean(joiningChallengeId && joiningChallengeId !== item.id)}
        />
      </Card>
    );
  }

  function renderOwnOpenChallenge({ item }: { item: OpenChallenge }) {
    return (
      <Card>
        <Text style={styles.playerName}>Your Open Challenge</Text>
        <Text style={styles.meta}>
          {item.sportName} · {getChallengeTypeLabel(item.challengeType)} · {getStakeDisplay(item.stakeType, item.stakeLabel)}
        </Text>
        <Text style={styles.meta}>{formatDateTime(item.scheduledAt)}</Text>
        <Text style={styles.meta}>{item.locationName}</Text>
        <Button
          label="Cancel Open Challenge"
          tone="secondary"
          onPress={() => void handleCancelOpenChallenge(item)}
          loading={cancelingChallengeId === item.id}
          disabled={Boolean(cancelingChallengeId && cancelingChallengeId !== item.id)}
        />
      </Card>
    );
  }

  if (sandboxMode && selectedPlayer) {
    const selectedSport = selectedPlayer.sports.find((entry) => entry.sport === sport) ?? selectedPlayer.sports[0];

    return (
      <Screen>
        <Card>
          <Text style={styles.kicker}>Player Selected</Text>
          <Text style={styles.title}>{selectedPlayer.username}</Text>
          {selectedPlayer.displayName !== selectedPlayer.username ? (
            <Text style={styles.displayName}>{selectedPlayer.displayName}</Text>
          ) : null}
          <Text style={styles.meta}>
            {selectedSport?.sport ?? sport} · {selectedSport?.skillLevel ?? "Player"}
          </Text>
          <Text style={styles.meta}>{selectedPlayer.vancouverArea} · {selectedPlayer.distanceKm.toFixed(1)} km away</Text>
        </Card>
        {sandboxMode === "loop-02" ? (
          <Button
            label="Challenge Player"
            onPress={() =>
              onCreateChallenge?.({
                opponentId: selectedPlayer.id,
                opponentUsername: selectedPlayer.username,
                sport,
                timingContext
              })
            }
          />
        ) : null}
        <Button label="Back to Nearby Players" tone="secondary" onPress={() => setSelectedPlayer(null)} />
      </Screen>
    );
  }

  return (
    <Screen scrollable={false}>
      <View style={styles.container}>
        <Card>
          <Text style={styles.kicker}>{isPlayNowMode ? "Play Now" : "Local Matchmaking"}</Text>
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Sport</Text>
            <View style={styles.filterWrap}>
              {enabledSports.map((option) => (
                <Chip
                  key={option.slug}
                  label={option.displayName}
                  selected={sport === option.slug}
                  onPress={() => setSport(option.slug)}
                />
              ))}
            </View>
          </View>

          {!isPlayNowMode ? (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>When do you want to play?</Text>
              <View style={styles.filterWrap}>
                {timingOptions.map((option) => (
                  <Chip
                    key={option}
                    label={getAvailabilityLabel(option)}
                    selected={timingContext === option}
                    onPress={() => setTimingContext(option)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {sandboxMode === "loop-02" ? (
            <View style={styles.loopTwoActions}>
              <Button label="Pending Challenges" tone="secondary" onPress={() => onNavigateToPendingChallenges?.()} />
              <Button label="Matches" tone="secondary" onPress={() => onNavigateToMatches?.()} />
              <Button label="Open Challenges" tone="secondary" onPress={() => onNavigateToOpenChallenges?.()} />
            </View>
          ) : null}
          {sandboxMode === "loop-02" && isPlayNowMode ? (
            <Button label="Post Open Challenge" onPress={() => onCreateChallenge?.({ mode: "open", sport })} />
          ) : null}
          {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
        </Card>

        {loading ? (
          <PlayerListSkeleton />
        ) : error ? (
          <Card>
            <Text style={styles.errorTitle}>{isPlayNowMode ? "Could not load Quick Match" : "Could not load players"}</Text>
            <Text style={styles.stateText}>
              {getDiagnosticErrorMessage(
                { message: error },
                isPlayNowMode ? "Unable to load Quick Match right now." : "Unable to load nearby players right now."
              )}
            </Text>
            <Button label="Try Again" tone="secondary" onPress={() => setReloadKey((value) => value + 1)} />
          </Card>
        ) : isPlayNowMode ? (
          <FlatList
            data={openChallenges}
            keyExtractor={(item) => item.id}
            renderItem={renderOpenChallenge}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.openChallengeHeader}>
                {ownOpenChallenges.map((challenge) => renderOwnOpenChallenge({ item: challenge }))}
                {openChallenges.length === 0 ? <Card><EmptyState title="No live games nearby yet" description={emptyDescription} /></Card> : null}
                {sandboxMode === null ? <Button label="Post Open Challenge" onPress={() => onCreateChallenge?.({ mode: "open", sport })} /> : null}
              </View>
            }
          />
        ) : players.length === 0 ? (
          <Card>
            <EmptyState title="No nearby players found" description={emptyDescription} />
            {sandboxMode ? null : (
              <Button
                label="Challenge a Friend"
                tone="secondary"
                onPress={() => {
                  onNavigateToFriendSearch?.();
                }}
              />
            )}
          </Card>
        ) : (
          <FlatList
            data={players}
            keyExtractor={(item) => item.id}
            renderItem={renderPlayer}
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
  kicker: {
    color: colors.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontSize: typography.overline
  },
  title: {
    color: colors.text,
    fontWeight: "800",
    fontSize: typography.title
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 24
  },
  filterSection: {
    gap: spacing.sm
  },
  loopTwoActions: {
    gap: spacing.sm
  },
  filterLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.overline
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  openChallengeHeader: {
    gap: spacing.md,
    marginBottom: spacing.md
  },
  stateText: {
    color: colors.textMuted,
    textAlign: "center"
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "700"
  },
  inlineError: {
    color: colors.danger,
    lineHeight: 21
  },
  playerName: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "700"
  },
  displayName: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 21
  },
  note: {
    color: colors.text,
    lineHeight: 21
  },
  reasonText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: "600"
  }
});
