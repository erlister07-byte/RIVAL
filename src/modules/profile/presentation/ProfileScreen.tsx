import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Check, Copy } from "lucide-react-native";

import { AppStackParamList, MainTabParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { SPORT_CONFIGS, getSportIdBySlug } from "@/config/sports";
import {
  PlayStyleTag,
  Profile,
  RecentMatch,
  RivalryRecord,
  availabilityOptions,
  getAvailabilityLabel,
  playStyleTagOptions
} from "@/core/types/models";
import { subscribeToMatchActivity } from "@/services/matchService";
import { formatRivalrySummary, getTopRivalries } from "@/services/rivalryService";
import { getProfileStats, getRecentMatches } from "@/services/userService";
import { uploadProfilePhoto } from "@/services/profilePhotoService";
import { AvailabilityBadge } from "@/shared/components/AvailabilityBadge";
import { Avatar } from "@/shared/components/Avatar";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { Screen } from "@/shared/components/Screen";
import { SportBadge } from "@/shared/components/SportBadge";
import { StatPill } from "@/shared/components/StatPill";
import { formatDateTime } from "@/shared/lib/format";
import { debugError, debugLog, getSafeErrorPayload } from "@/shared/lib/logger";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { currentUser, logout, updateAvailability, updatePlayStyleTags } = useAppState();
  const isFocused = useIsFocused();
  const appNavigation = navigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
  const [stats, setStats] = useState<Pick<Profile, "wins" | "losses" | "matchesPlayed">>({
    wins: 0,
    losses: 0,
    matchesPlayed: 0
  });
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [topRivalries, setTopRivalries] = useState<RivalryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [playStyleMessage, setPlayStyleMessage] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [updatingPlayStyle, setUpdatingPlayStyle] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!copyMessage && !avatarMessage && !playStyleMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setCopyMessage("");
      setAvatarMessage("");
      setPlayStyleMessage("");
    }, 2200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [avatarMessage, copyMessage, playStyleMessage]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    debugLog("[ProfileScreen] syncing stats from currentUser", {
      profileId: currentUser.id,
      wins: currentUser.wins,
      losses: currentUser.losses,
      matchesPlayed: currentUser.matchesPlayed
    });
    setStats({
      wins: currentUser.wins,
      losses: currentUser.losses,
      matchesPlayed: currentUser.matchesPlayed
    });
  }, [currentUser?.id, currentUser?.wins, currentUser?.losses, currentUser?.matchesPlayed]);

  useEffect(() => {
    let isActive = true;

    async function loadProfileData() {
      if (!currentUser?.id) {
        if (isActive) {
          setLoading(false);
          setStats({ wins: 0, losses: 0, matchesPlayed: 0 });
          setRecentMatches([]);
        }
        return;
      }

      setLoading(true);
      setError("");
      debugLog("[ProfileScreen] loading profile stats and history", {
        profileId: currentUser.id,
        isFocused
      });

      try {
        const [nextStats, nextRecentMatches] = await Promise.all([
          getProfileStats(currentUser.id),
          getRecentMatches(currentUser.id)
        ]);
        const nextRivalries = await getTopRivalries(currentUser.id);

        if (!isActive) {
          return;
        }

        debugLog("[ProfileScreen] profile stats loaded", {
          profileId: currentUser.id,
          wins: nextStats.wins,
          losses: nextStats.losses,
          matchesPlayed: nextStats.matchesPlayed,
          recentMatchCount: nextRecentMatches.length,
          rivalryCount: nextRivalries.length
        });
        setStats(nextStats);
        setRecentMatches(nextRecentMatches);
        setTopRivalries(nextRivalries);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error && loadError.message
            ? loadError.message
            : "Unable to load profile data right now."
        );
        setStats({ wins: 0, losses: 0, matchesPlayed: 0 });
        setRecentMatches([]);
        setTopRivalries([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadProfileData();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, isFocused, reloadKey]);

  useEffect(() => {
    if (!currentUser?.id || !isFocused) {
      return;
    }

    const realtimeChannel = subscribeToMatchActivity(currentUser.id, () => {
      setReloadKey((value) => value + 1);
    });

    return () => {
      void realtimeChannel.unsubscribe();
    };
  }, [currentUser?.id, isFocused]);

  async function handleCopyUsername() {
    if (!currentUser?.username?.trim()) {
      return;
    }

    await Clipboard.setStringAsync(currentUser.username.trim());
    setCopyMessage("Username copied");
  }

  async function handlePickAvatar() {
    if (!currentUser?.id || uploadingAvatar) {
      console.log("[ProfileScreen] avatar picker blocked", {
        hasProfileId: Boolean(currentUser?.id),
        profileId: currentUser?.id,
        uploadingAvatar
      });
      debugLog("[ProfileScreen] avatar picker blocked", {
        hasProfileId: Boolean(currentUser?.id),
        uploadingAvatar
      });
      return;
    }

    console.log("[ProfileScreen] avatar picker open", {
      profileId: currentUser.id
    });
    debugLog("[ProfileScreen] requesting avatar picker permission", {
      profileId: currentUser.id
    });
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      debugLog("[ProfileScreen] avatar picker permission denied", {
        profileId: currentUser.id
      });
      setAvatarMessage("Photo access is needed to upload an avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75
    });

    if (result.canceled || !result.assets[0]) {
      console.log("[ProfileScreen] avatar picker result", {
        profileId: currentUser.id,
        canceled: result.canceled,
        assetsCount: result.assets?.length ?? 0
      });
      debugLog("[ProfileScreen] avatar picker canceled", {
        profileId: currentUser.id,
        canceled: result.canceled
      });
      return;
    }

    console.log("[ProfileScreen] avatar picker result", {
      profileId: currentUser.id,
      canceled: result.canceled,
      assetsCount: result.assets?.length ?? 0,
      assetUri: result.assets[0].uri,
      mimeType: result.assets[0].mimeType,
      fileName: result.assets[0].fileName,
      fileSize: result.assets[0].fileSize,
      width: result.assets[0].width,
      height: result.assets[0].height
    });
    debugLog("[ProfileScreen] avatar asset selected", {
      profileId: currentUser.id,
      assetUri: result.assets[0].uri,
      mimeType: result.assets[0].mimeType,
      fileName: result.assets[0].fileName,
      fileSize: result.assets[0].fileSize,
      width: result.assets[0].width,
      height: result.assets[0].height
    });

    setUploadingAvatar(true);
    setAvatarMessage("");

    try {
      console.log("[ProfileScreen] avatar upload call start", {
        profileId: currentUser.id,
        imageUri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType
      });
      const { avatarUrl, version } = await uploadProfilePhoto({
        profileId: currentUser.id,
        imageUri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType
      });

      console.log("[ProfileScreen] avatar upload call success", {
        profileId: currentUser.id,
        avatarUrl,
        version
      });
      debugLog("[ProfileScreen] avatar upload returned successfully", {
        profileId: currentUser.id,
        avatarUrl,
        version
      });

      setAvatarUrlOverride(avatarUrl);
      setAvatarVersion(version);
      setAvatarMessage("Photo updated");

      console.log("[ProfileScreen] avatar profile state refresh", {
        profileId: currentUser.id,
        avatarUrl,
        version
      });
      debugLog("[ProfileScreen] avatar state updated", {
        profileId: currentUser.id,
        avatarUrl,
        version
      });
    } catch (error) {
      const safeError = getSafeErrorPayload(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : [safeError.message, safeError.details, safeError.code].filter(Boolean).join(" | ") || "Unknown error";

      console.error("[ProfileScreen] avatar upload caught error", {
        profileId: currentUser.id,
        assetUri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        error,
        safeError
      });
      debugError("[ProfileScreen] avatar upload failed", error, {
        profileId: currentUser.id,
        assetUri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType
      });
      setAvatarMessage(`Avatar upload failed: ${errorMessage}`);
      Alert.alert("Avatar upload failed", errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvailabilityChange(nextAvailability: Profile["availabilityStatus"]) {
    if (!currentUser || updatingAvailability || nextAvailability === currentUser.availabilityStatus) {
      return;
    }

    setUpdatingAvailability(true);

    try {
      await updateAvailability(nextAvailability);
    } catch (updateError) {
      setAvatarMessage(
        updateError instanceof Error && updateError.message
          ? updateError.message
          : "Unable to update availability right now."
      );
    } finally {
      setUpdatingAvailability(false);
    }
  }

  async function handlePlayStyleToggle(tag: PlayStyleTag) {
    if (!currentUser || updatingPlayStyle) {
      return;
    }

    const currentTags = currentUser.playStyleTags ?? [];
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((item) => item !== tag)
      : currentTags.length >= 3
        ? currentTags
        : [...currentTags, tag];

    if (!currentTags.includes(tag) && currentTags.length >= 3) {
      setPlayStyleMessage("Choose up to 3.");
      return;
    }

    setUpdatingPlayStyle(true);
    setPlayStyleMessage("");

    try {
      await updatePlayStyleTags(nextTags);
      setPlayStyleMessage("Play style updated");
    } catch (updateError) {
      setPlayStyleMessage(
        updateError instanceof Error && updateError.message
          ? updateError.message
          : "Unable to update play style right now."
      );
    } finally {
      setUpdatingPlayStyle(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.kicker}>Account</Text>
        <View style={styles.accountHeader}>
          <Avatar
            profileId={currentUser?.id}
            avatarUrl={avatarUrlOverride ?? undefined}
            avatarVersion={avatarVersion ?? undefined}
            username={currentUser?.username}
            displayName={currentUser?.displayName}
            size={88}
          />
          <View style={styles.accountIdentity}>
            <Text style={styles.usernameLabel}>Username</Text>
            <Text style={styles.usernameValue}>
              {currentUser?.username?.trim() ? `@${currentUser.username.trim()}` : "Username unavailable"}
            </Text>
            <Pressable
              onPress={() => void handlePickAvatar()}
              disabled={!currentUser?.id || uploadingAvatar}
              style={({ pressed }) => [
                styles.photoButton,
                pressed && !uploadingAvatar ? styles.copyButtonPressed : null,
                uploadingAvatar ? styles.copyButtonDisabled : null
              ]}
            >
              <Text style={styles.photoButtonText}>
                {uploadingAvatar ? "Uploading..." : avatarUrlOverride ? "Change Photo" : "Add Photo"}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.usernameRow}>
          <Text style={styles.usernameValueInline}>
            {currentUser?.username?.trim() ? `@${currentUser.username.trim()}` : "Username unavailable"}
          </Text>
          <Pressable
            onPress={() => void handleCopyUsername()}
            disabled={!currentUser?.username?.trim()}
            style={({ pressed }) => [
              styles.copyButton,
              pressed && currentUser?.username?.trim() ? styles.copyButtonPressed : null,
              !currentUser?.username?.trim() ? styles.copyButtonDisabled : null
            ]}
          >
            {copyMessage ? (
              <Check size={16} color={colors.success} strokeWidth={2.2} />
            ) : (
              <Copy
                size={16}
                color={currentUser?.username?.trim() ? colors.accent : colors.textMuted}
                strokeWidth={2.2}
              />
            )}
            <Text
              style={[
                styles.copyButtonText,
                !currentUser?.username?.trim() ? styles.copyButtonTextDisabled : null,
                copyMessage ? styles.copyButtonTextSuccess : null
              ]}
            >
              Copy Username
            </Text>
          </Pressable>
        </View>
        {copyMessage ? <Text style={styles.copyMessage}>{copyMessage}</Text> : null}
        {avatarMessage ? <Text style={styles.copyMessage}>{avatarMessage}</Text> : null}
        {playStyleMessage ? <Text style={styles.copyMessage}>{playStyleMessage}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.kicker}>Availability</Text>
        <View style={styles.availabilityHeader}>
          <AvailabilityBadge status={currentUser?.availabilityStatus ?? "unavailable"} />
          <Text style={styles.rowMeta}>
            Let nearby players know when you are easiest to challenge.
          </Text>
        </View>
        <View style={styles.availabilityWrap}>
          {availabilityOptions.map((option) => (
            <Chip
              key={option}
              label={getAvailabilityLabel(option)}
              selected={currentUser?.availabilityStatus === option}
              disabled={updatingAvailability}
              onPress={() => void handleAvailabilityChange(option)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.kicker}>Play Style</Text>
        <Text style={styles.sectionHeader}>How you like to play</Text>
        <Text style={styles.rowMeta}>Help others know what kind of game to expect. Choose up to 3.</Text>
        <View style={styles.availabilityWrap}>
          {playStyleTagOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={currentUser?.playStyleTags.includes(option.value) ?? false}
              disabled={updatingPlayStyle}
              onPress={() => void handlePlayStyleToggle(option.value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.kicker}>Performance</Text>
        <Text style={styles.sectionHeader}>Stats</Text>
        <View style={styles.statsRow}>
          <StatPill label="Wins" value={stats.wins} />
          <StatPill label="Losses" value={stats.losses} />
          <StatPill label="Played" value={stats.matchesPlayed} />
        </View>
      </Card>

      <Card>
        <Text style={styles.kicker}>Sports</Text>
        <Text style={styles.sectionHeader}>Sports</Text>
        {SPORT_CONFIGS.map((sport) => {
          const activeSport = currentUser?.sports.find((item) => item.sport === sport.slug);

          return (
            <View
              key={sport.slug}
              style={[
                styles.sportRow,
                sport.enabled ? styles.sportRowActive : styles.sportRowDisabled
              ]}
            >
              <View style={styles.sportRowTitle}>
                <SportBadge sport={sport.slug} size="small" isEnabled={sport.enabled} />
                <Text style={[styles.rowText, !sport.enabled ? styles.rowTextDisabled : styles.rowTextActive]}>{sport.displayName}</Text>
              </View>
              <Text style={styles.rowMeta}>
                {activeSport ? `${activeSport.skillLevel} · ${sport.enabled ? "live" : "coming soon"}` : sport.cityAvailability}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.kicker}>History</Text>
        <Text style={styles.sectionHeader}>Recent matches</Text>
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.rowMeta}>Loading confirmed matches...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : recentMatches.length === 0 ? (
          <>
            <EmptyState
              title="No confirmed matches yet"
              description="Play your first match to get on the board and start building your record."
            />
            <Button
              label="Challenge a Player"
              tone="secondary"
              onPress={() => appNavigation?.navigate("CreateChallenge")}
            />
          </>
        ) : (
          recentMatches.slice(0, 4).map((match) => {
            const rivalry = topRivalries.find((record) => record.opponentProfileId === match.opponentProfileId);

            return (
              <View key={match.id} style={styles.matchRow}>
                <Text style={styles.rowText}>
                  {match.sport} vs {match.opponentName}
                </Text>
                <Text style={styles.rowMeta}>
                  {match.scoreSummary} · {match.result}
                </Text>
                <Text style={styles.rowMeta}>{formatDateTime(match.date)}</Text>
                {rivalry ? (
                  <Text style={styles.rivalryMeta}>
                    Record vs {match.opponentName}: {formatRivalrySummary(rivalry)}
                  </Text>
                ) : null}
                <View style={styles.rematchAction}>
                  <Button
                    label="Challenge Again"
                    tone="secondary"
                    onPress={() =>
                      appNavigation?.navigate("CreateChallenge", {
                        opponentId: match.opponentProfileId,
                        opponentName: match.opponentName,
                        sportId: getSportIdBySlug(match.sport),
                        isRematch: true
                      })
                    }
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Button label="Log Out" tone="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontSize: typography.overline,
    marginBottom: -2
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  availabilityHeader: {
    gap: spacing.xs
  },
  availabilityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  sectionHeader: {
    fontWeight: "700",
    color: colors.text,
    fontSize: typography.heading,
    marginBottom: -2
  },
  usernameLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.overline
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 2
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: 2
  },
  accountIdentity: {
    flex: 1,
    gap: 4
  },
  usernameValue: {
    flex: 1,
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.heading
  },
  usernameValueInline: {
    flex: 1,
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.bodyStrong
  },
  photoButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white
  },
  photoButtonText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: typography.caption
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white
  },
  copyButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }]
  },
  copyButtonDisabled: {
    opacity: 0.55
  },
  copyButtonText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: typography.caption
  },
  copyButtonTextDisabled: {
    color: colors.textMuted
  },
  copyButtonTextSuccess: {
    color: colors.success
  },
  copyMessage: {
    color: colors.success,
    fontWeight: "600",
    fontSize: typography.caption,
    marginTop: -2
  },
  rowText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: typography.bodyStrong
  },
  rowMeta: {
    color: colors.textMuted,
    lineHeight: 21
  },
  sportRow: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  sportRowActive: {
    backgroundColor: colors.accentSoft
  },
  sportRowDisabled: {
    opacity: 0.66
  },
  sportRowTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  rowTextActive: {
    color: colors.primary
  },
  rowTextDisabled: {
    color: colors.textMuted
  },
  rivalryMeta: {
    color: colors.text,
    fontWeight: "600"
  },
  matchRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs
  },
  rematchAction: {
    marginTop: spacing.sm,
    alignSelf: "flex-start"
  },
  stateContainer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  errorText: {
    color: colors.danger,
    textAlign: "center"
  }
});
