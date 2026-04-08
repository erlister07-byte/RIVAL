import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { CircleUserRound, MapPin } from "lucide-react-native";

import { AppStackParamList } from "@/application/navigation/types";
import { colors, spacing, typography } from "@/application/theme";
import { useAppState } from "@/application/providers/AppProvider";
import { Badge } from "@/components/ui/Badge";
import {
  DEFAULT_LAUNCH_SPORT,
  SPORT_CONFIGS,
  getDisabledSportConfigs,
  getSportConfigById,
  isSportEnabled
} from "@/config/sports";
import {
  AvailabilityStatus,
  ChallengeType,
  MatchFormat,
  SportSlug,
  getPlayStyleTagLabel,
  getStakeDisplay
} from "@/core/types/models";
import { getUserProfile } from "@/services/userService";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { Input } from "@/shared/components/Input";
import { Avatar } from "@/shared/components/Avatar";
import { SuccessBanner } from "@/shared/components/SuccessBanner";
import { SportSelectionRow } from "@/shared/components/SportSelectionRow";
import { debugLog } from "@/shared/lib/logger";
import { getUserSafeErrorMessage } from "@/shared/lib/serviceError";
import { useTimedSuccess } from "@/shared/lib/useTimedSuccess";
import { Screen } from "@/shared/components/Screen";

type Props = NativeStackScreenProps<AppStackParamList, "CreateChallenge">;

const STAKE_OPTIONS = [
  { type: "bragging_rights", label: "Bragging Rights", icon: "🏆", meta: "Default", placeholder: "Winner gets to brag!" },
  { type: "coffee", label: "Coffee", icon: "☕", meta: "Optional preset", placeholder: "Loser buys coffee" },
  { type: "drinks", label: "Drinks", icon: "🍺", meta: "Optional preset", placeholder: "Loser buys drinks" },
  { type: "court_fee", label: "Court Fees", icon: "💰", meta: "Optional preset", placeholder: "Loser pays court fees" },
  { type: "custom", label: "Custom Stakes", icon: "✍️", meta: "Define your own terms", placeholder: "Example: Loser pays $10" }
] as const;

type StakeOption = (typeof STAKE_OPTIONS)[number];

function getInitialSport(
  params: AppStackParamList["CreateChallenge"]
): SportSlug {
  if (params?.sportId) {
    const sport = getSportConfigById(params.sportId)?.slug;
    if (sport && isSportEnabled(sport)) {
      return sport;
    }
  }

  if (params?.sport && isSportEnabled(params.sport)) {
    return params.sport;
  }

  return DEFAULT_LAUNCH_SPORT;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeKey(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatSchedulePreview(date: Date) {
  return date.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getScheduledAtSeed(context?: AvailabilityStatus) {
  const next = new Date();

  if (context === "now") {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 2);
    return next;
  }

  if (context === "this_week") {
    next.setDate(next.getDate() + 3);
    next.setHours(18, 30, 0, 0);
    return next;
  }

  next.setHours(18, 30, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function toDateOnly(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toTimeOnly(date: Date) {
  const next = new Date();
  next.setHours(date.getHours(), date.getMinutes(), 0, 0);
  return next;
}

function buildScheduledAt(dateValue: Date, timeValue: Date) {
  const next = new Date(dateValue);
  next.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
  return next;
}

function getTimeOptions(intervalMinutes = 15) {
  const options: Array<{ key: string; label: string; value: Date }> = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const value = new Date();
      value.setHours(hour, minute, 0, 0);
      options.push({
        key: formatTimeKey(value),
        label: formatTimeLabel(value),
        value
      });
    }
  }

  return options;
}

type ActivePicker = "date" | "time" | null;

export function CreateChallengeScreen({ navigation, route }: Props) {
  const { currentUser, nearbyPlayers, createChallenge } = useAppState();
  const isFocused = useIsFocused();
  const isRematch = route.params?.isRematch ?? false;
  const challengeMode = route.params?.mode ?? "direct";
  const isOpenChallengeMode = challengeMode === "open";
  const isOpponentPrefilled = Boolean(route.params?.opponentId);
  const [sport, setSport] = useState<SportSlug>(getInitialSport(route.params));
  const [opponentId, setOpponentId] = useState(route.params?.opponentId ?? "");
  const initialSchedule = useMemo(() => getScheduledAtSeed(route.params?.timingContext), [route.params?.timingContext]);
  const [selectedDate, setSelectedDate] = useState(() => toDateOnly(initialSchedule));
  const [selectedTime, setSelectedTime] = useState(() => toTimeOnly(initialSchedule));
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [locationName, setLocationName] = useState(route.params?.locationName ?? "Kits Beach Courts");
  const challengeType: ChallengeType = "casual";
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("singles");
  const [selectedStakeType, setSelectedStakeType] = useState<StakeOption["type"]>("bragging_rights");
  const [stakeNote, setStakeNote] = useState(route.params?.stakeNote ?? "");
  const [stakeNoteError, setStakeNoteError] = useState("");
  const [prefilledOpponentName, setPrefilledOpponentName] = useState("");
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { success, showSuccess, clearSuccess } = useTimedSuccess();
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefilledOpponentUsername = route.params?.opponentUsername ?? route.params?.opponentName ?? prefilledOpponentName;
  const rematchOpponentName = route.params?.opponentName ?? route.params?.opponentUsername ?? prefilledOpponentName;
  const scheduledAt = useMemo(() => buildScheduledAt(selectedDate, selectedTime), [selectedDate, selectedTime]);
  const minDateKey = useMemo(() => formatDateKey(new Date()), []);
  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const selectedTimeKey = useMemo(() => formatTimeKey(selectedTime), [selectedTime]);
  const markedDates = useMemo(
    () => ({
      [selectedDateKey]: {
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: colors.background
      }
    }),
    [selectedDateKey]
  );
  const timeOptions = useMemo(() => getTimeOptions(), []);

  useEffect(() => {
    if (route.params?.sportId) {
      const routeSport = getSportConfigById(route.params.sportId)?.slug;
      if (routeSport && isSportEnabled(routeSport)) {
        setSport(routeSport);
      }
    } else if (route.params?.sport && isSportEnabled(route.params.sport)) {
      setSport(route.params.sport);
    }

    if (route.params?.opponentId) {
      setOpponentId(route.params.opponentId);
    }

    if (route.params?.stakeNote !== undefined) {
      setStakeNote(route.params.stakeNote);
    }

    if (route.params?.locationName) {
      setLocationName(route.params.locationName);
    }

    if (route.params?.timingContext) {
      const nextSchedule = getScheduledAtSeed(route.params.timingContext);
      setSelectedDate(toDateOnly(nextSchedule));
      setSelectedTime(toTimeOnly(nextSchedule));
    }
  }, [route.params?.opponentId, route.params?.sportId, route.params?.sport, route.params?.stakeNote, route.params?.locationName, route.params?.timingContext]);

  useEffect(() => {
    if (sport !== "pickleball" && matchFormat !== "singles") {
      setMatchFormat("singles");
    }
  }, [matchFormat, sport]);

  useEffect(() => {
    let isActive = true;

    async function loadPrefilledOpponent() {
      const routedOpponentId = route.params?.opponentId;

      if (!routedOpponentId) {
        if (isActive) {
          setPrefilledOpponentName("");
          setPrefillLoading(false);
        }
        return;
      }

      const existingOption = nearbyPlayers.find((player) => player.id === routedOpponentId);
      if (existingOption) {
        if (isActive) {
          setPrefilledOpponentName(route.params?.opponentUsername ?? existingOption.username);
          setPrefillLoading(false);
        }
        return;
      }

      setPrefillLoading(true);
      try {
        const profile = await getUserProfile({ profileId: routedOpponentId });
        if (isActive) {
          setPrefilledOpponentName(route.params?.opponentUsername ?? profile?.username ?? "Selected opponent");
        }
      } catch {
        if (isActive) {
          setPrefilledOpponentName(route.params?.opponentUsername ?? "Selected opponent");
        }
      } finally {
        if (isActive) {
          setPrefillLoading(false);
        }
      }
    }

    void loadPrefilledOpponent();

    return () => {
      isActive = false;
    };
  }, [nearbyPlayers, route.params?.opponentId, route.params?.opponentUsername]);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isFocused) {
      clearSuccess();
    }
  }, [clearSuccess, isFocused]);

  const opponentOptions = useMemo(() => {
    const baseOptions = nearbyPlayers.filter((player) => player.id !== currentUser?.id);
    const routedOpponentId = route.params?.opponentId;

    if (!routedOpponentId || baseOptions.some((player) => player.id === routedOpponentId)) {
      return baseOptions;
    }

    return [
      {
        id: routedOpponentId,
        username: route.params?.opponentUsername ?? prefilledOpponentName ?? "selected.opponent",
        displayName: prefilledOpponentName || "Selected opponent",
        email: "",
        vancouverArea: currentUser?.vancouverArea ?? "Vancouver",
        challengeRadiusKm: 0,
        availabilityStatus: route.params?.timingContext ?? "unavailable",
        onboardingCompleted: true,
        sports:
          route.params?.sportId && getSportConfigById(route.params.sportId)?.slug
            ? [{ sport: getSportConfigById(route.params.sportId)?.slug ?? DEFAULT_LAUNCH_SPORT, skillLevel: "intermediate" }]
            : route.params?.sport && isSportEnabled(route.params.sport)
              ? [{ sport: route.params.sport, skillLevel: "intermediate" }]
              : [],
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        playStyleTags: [],
        distanceKm: 0
      },
      ...baseOptions
    ];
  }, [
    currentUser?.id,
    currentUser?.vancouverArea,
    nearbyPlayers,
    prefilledOpponentName,
    route.params?.opponentId,
    route.params?.sportId,
    route.params?.sport
  ]);

  const selectedOpponent = useMemo(
    () => opponentOptions.find((option) => option.id === opponentId),
    [opponentId, opponentOptions]
  );
  const selectedStake = useMemo(
    () => STAKE_OPTIONS.find((option) => option.type === selectedStakeType) ?? STAKE_OPTIONS[0],
    [selectedStakeType]
  );

  const selectedOpponentUsername = selectedOpponent?.username ?? prefilledOpponentUsername ?? "";
  const selectedOpponentDisplayName = selectedOpponent?.displayName;

  function handleDateRowPress() {
    setActivePicker((current) => (current === "date" ? null : "date"));
  }

  function handleTimeRowPress() {
    setActivePicker((current) => (current === "time" ? null : "time"));
  }

  function handleCalendarDateSelect(day: DateData) {
    const next = new Date();
    next.setFullYear(day.year, day.month - 1, day.day);
    next.setHours(0, 0, 0, 0);
    setSelectedDate(next);
    setActivePicker(null);
  }

  function handleTimeSelect(timeValue: Date) {
    setSelectedTime(toTimeOnly(timeValue));
    setActivePicker(null);
  }

  async function handleSubmit() {
    const normalizedLocation = locationName.trim();
    const normalizedStakeNote = stakeNote.trim();

    if (!isOpenChallengeMode && !opponentId) {
      setError("Select an opponent first.");
      return;
    }

    if (!normalizedLocation || !selectedDate || !selectedTime) {
      setError("Add the match time and location before sending the challenge.");
      return;
    }

    if (!isOpenChallengeMode && opponentId === currentUser?.id) {
      setError("You cannot challenge yourself.");
      return;
    }

    if (Number.isNaN(scheduledAt.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      setError("Challenge time must be in the future.");
      return;
    }

    if (selectedStakeType === "custom" && !normalizedStakeNote) {
      setError("");
      setStakeNoteError("Please describe the stakes");
      return;
    }

    debugLog("[CreateChallengeScreen] submitting challenge", {
      challengerProfileId: currentUser?.id,
      opponentId: opponentId || null,
      opponentUsername: prefilledOpponentUsername,
      sport,
      matchFormat,
      challengeMode
    });

    setError("");
    setStakeNoteError("");
    clearSuccess();
    setLoading(true);

    try {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }

      debugLog("[CreateChallengeScreen] creating challenge record", {
        challengerProfileId: currentUser?.id,
        opponentId: opponentId || null,
        sport,
        challengeType,
        challengeMode
      });

      await createChallenge({
        sport,
        opponentProfileId: isOpenChallengeMode ? undefined : opponentId,
        scheduledAt: scheduledAt.toISOString(),
        locationName: normalizedLocation,
        challengeType,
        stakeType: selectedStake.type,
        stakeLabel: selectedStake.label,
        stakeNote: normalizedStakeNote || undefined,
        mode: challengeMode
      });

      const successLabel = selectedOpponentUsername ? `@${selectedOpponentUsername}` : "your opponent";
      showSuccess(
        isOpenChallengeMode ? "Open challenge posted" : "Challenge sent",
        isOpenChallengeMode
          ? `It is now live in Quick Match · Stakes: ${getStakeDisplay(selectedStake.type, selectedStake.label)}`
          : `Waiting for opponent to accept · Stakes: ${getStakeDisplay(selectedStake.type, selectedStake.label)}`
      );
      debugLog("[CreateChallengeScreen] challenge created successfully", {
        opponentId: opponentId || null,
        successLabel
      });
      debugLog("[CreateChallengeScreen] resetting navigation to Home tab");
      resetTimeoutRef.current = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Tabs",
              state: {
                index: 0,
                routes: [{ name: "Home" }]
              }
            }
          ]
        });
        resetTimeoutRef.current = null;
      }, 900);
    } catch (submissionError) {
      setError(getUserSafeErrorMessage(submissionError, "Unable to create challenge."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      {success ? <SuccessBanner title={success.title} hint={success.hint} onDismiss={clearSuccess} /> : null}
      {isRematch && rematchOpponentName ? (
        <Text style={styles.rematchLabel}>Rematch with {rematchOpponentName}</Text>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>{isOpenChallengeMode ? "Challenge Visibility" : "Opponent"}</Text>
        {isOpenChallengeMode ? (
          <View style={styles.openChallengeCard}>
            <View style={styles.opponentChoiceIcon}>
              <MapPin size={22} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.openChallengeText}>
              <Text style={styles.opponentChoiceTitle}>Open challenge</Text>
              <Text style={styles.opponentChoiceSubtitle}>
                Post this to Quick Match so any nearby player can accept it.
              </Text>
            </View>
            <Badge label="Public" tone="success" />
          </View>
        ) : isOpponentPrefilled ? (
          <View style={styles.lockedOpponentCard}>
            <View style={styles.opponentIdentity}>
              <Avatar
                profileId={route.params?.opponentId}
                username={selectedOpponentUsername || undefined}
                displayName={selectedOpponentDisplayName}
                size={48}
              />
              <View style={styles.lockedOpponentText}>
                <Text style={styles.lockedOpponentName}>
                  {selectedOpponentUsername ? `@${selectedOpponentUsername}` : "Selected opponent"}
                </Text>
                <Text style={styles.prefillText}>Opponent locked in</Text>
                {selectedOpponent?.playStyleTags.length ? (
                  <View style={styles.playStyleRow}>
                    {selectedOpponent.playStyleTags.slice(0, 2).map((tag) => (
                      <Text key={tag} style={styles.playStyleTag}>
                        {getPlayStyleTagLabel(tag)}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
            <Badge label="Locked" tone="default" />
          </View>
        ) : (
          <>
            {prefillLoading ? (
              <View style={styles.prefillState}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.prefillText}>Loading rematch opponent...</Text>
              </View>
            ) : null}
            {!opponentId ? (
              <View style={styles.emptyOpponentState}>
                <Text style={styles.emptyOpponentTitle}>Choose your opponent</Text>
                <View style={styles.opponentChoiceList}>
                  <Pressable
                    onPress={() => navigation.navigate("FriendSearch")}
                    style={({ pressed }) => [
                      styles.opponentChoiceCard,
                      pressed ? styles.opponentChoicePressed : null
                    ]}
                  >
                    <View style={styles.opponentChoiceIcon}>
                      <CircleUserRound size={22} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <View style={styles.opponentChoiceText}>
                      <Text style={styles.opponentChoiceTitle}>Challenge a Friend</Text>
                      <Text style={styles.opponentChoiceSubtitle}>Search by username</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      navigation.navigate("NearbyPlayers", {
                        sport,
                        availability: route.params?.timingContext ?? "today",
                        mode: "play_now"
                      })
                    }
                    style={({ pressed }) => [
                      styles.opponentChoiceCard,
                      pressed ? styles.opponentChoicePressed : null
                    ]}
                  >
                    <View style={styles.opponentChoiceIcon}>
                      <MapPin size={22} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <View style={styles.opponentChoiceText}>
                      <Text style={styles.opponentChoiceTitle}>Choose Nearby Player</Text>
                      <Text style={styles.opponentChoiceSubtitle}>Find players near you</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.selectedOpponentCard}>
                <View style={styles.opponentIdentity}>
                  <Avatar
                    profileId={selectedOpponent?.id}
                    username={selectedOpponentUsername || undefined}
                    displayName={selectedOpponentDisplayName}
                    size={48}
                  />
                  <View style={styles.lockedOpponentText}>
                    <Text style={styles.lockedOpponentName}>
                      {selectedOpponentUsername ? `@${selectedOpponentUsername}` : "Selected opponent"}
                    </Text>
                    <Text style={styles.prefillText}>Ready to challenge</Text>
                    {selectedOpponent?.playStyleTags.length ? (
                      <View style={styles.playStyleRow}>
                        {selectedOpponent.playStyleTags.slice(0, 2).map((tag) => (
                          <Text key={tag} style={styles.playStyleTag}>
                            {getPlayStyleTagLabel(tag)}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
                <Button label="Change Opponent" tone="secondary" onPress={() => navigation.navigate("FriendSearch")} />
              </View>
            )}
            {!isOpponentPrefilled && opponentId && opponentOptions.length > 0 ? (
              <>
                <Text style={styles.optionHint}>Want someone else? Pick a different player.</Text>
                <View style={styles.wrap}>
                  {opponentOptions.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.username}
                      selected={opponentId === option.id}
                      onPress={() => setOpponentId(option.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Match setup</Text>
        <Text style={styles.label}>Sport</Text>
        <Text style={styles.helperText}>Pickleball is live now. Additional sports stay visible in the roadmap section below.</Text>
        <View style={styles.sportList}>
          {SPORT_CONFIGS.filter((option) => option.enabled).map((option) => (
            <SportSelectionRow
              key={option.slug}
              sport={option.slug}
              label={option.displayName}
              meta={option.cityAvailability}
              isSelected={sport === option.slug}
              isEnabled={option.enabled}
              showLiveBadge={option.enabled}
              onPress={() => setSport(option.slug)}
            />
          ))}
        </View>
      </Card>

      {sport === "pickleball" ? (
        <Card>
          <Text style={styles.sectionTitle}>Match Format</Text>
          <Text style={styles.helperText}>Choose the format for this pickleball match request.</Text>
          <View style={styles.formatList}>
            <Pressable
              onPress={() => setMatchFormat("singles")}
              style={({ pressed }) => [
                styles.formatOption,
                matchFormat === "singles" ? styles.formatOptionSelected : null,
                pressed ? styles.formatOptionPressed : null
              ]}
            >
              <View style={styles.formatOptionText}>
                <Text style={styles.formatOptionTitle}>Singles (1v1)</Text>
                <Text style={styles.formatOptionMeta}>The standard head-to-head challenge flow.</Text>
              </View>
              {matchFormat === "singles" ? <Badge label="Selected" tone="success" /> : null}
            </Pressable>

            <Pressable
              onPress={() => setMatchFormat("doubles")}
              style={({ pressed }) => [
                styles.formatOption,
                matchFormat === "doubles" ? styles.formatOptionSelected : null,
                pressed ? styles.formatOptionPressed : null
              ]}
            >
              <View style={styles.formatOptionText}>
                <Text style={styles.formatOptionTitle}>Doubles (2v2)</Text>
                <Text style={styles.formatOptionMeta}>Team details can be finalized later. Doubles support is in beta.</Text>
              </View>
              {matchFormat === "doubles" ? <Badge label="Selected" tone="default" /> : null}
            </Pressable>
          </View>
        </Card>
      ) : null}

      {getDisabledSportConfigs().length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.prefillText}>These sports are visible for the roadmap but not live in Vancouver yet.</Text>
          <View style={styles.wrap}>
            {getDisabledSportConfigs().map((option) => (
              <Badge key={option.slug} label={option.displayName} tone="default" />
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Timing</Text>
        <Text style={styles.helperText}>Choose the date and time for the match.</Text>
        <Pressable
          onPress={handleDateRowPress}
          style={({ pressed }) => [styles.pickerField, pressed ? styles.pickerFieldPressed : null]}
        >
          <Text style={styles.pickerFieldLabel}>Date</Text>
          <Text style={styles.pickerFieldValue}>{formatDateLabel(selectedDate)}</Text>
        </Pressable>
        {activePicker === "date" ? (
          <View style={styles.calendarContainer}>
            <Calendar
              current={selectedDateKey}
              minDate={minDateKey}
              markedDates={markedDates}
              onDayPress={handleCalendarDateSelect}
              enableSwipeMonths
              theme={{
                backgroundColor: colors.surfaceMuted,
                calendarBackground: colors.surfaceMuted,
                textSectionTitleColor: colors.textMuted,
                monthTextColor: colors.text,
                dayTextColor: colors.text,
                textDisabledColor: colors.textMuted,
                arrowColor: colors.text,
                todayTextColor: colors.primary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: colors.background,
                textDayFontWeight: "600",
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "700"
              }}
            />
          </View>
        ) : null}
        <Pressable
          onPress={handleTimeRowPress}
          style={({ pressed }) => [styles.pickerField, pressed ? styles.pickerFieldPressed : null]}
        >
          <Text style={styles.pickerFieldLabel}>Time</Text>
          <Text style={styles.pickerFieldValue}>{formatTimeLabel(selectedTime)}</Text>
        </Pressable>
        {activePicker === "time" ? (
          <View style={styles.timeOptionsContainer}>
            <ScrollView style={styles.timeOptionsScroll} nestedScrollEnabled>
              <View style={styles.timeOptionsContent}>
                {timeOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => handleTimeSelect(option.value)}
                    style={({ pressed }) => [
                      styles.timeOptionRow,
                      selectedTimeKey === option.key ? styles.timeOptionRowSelected : null,
                      pressed ? styles.timeOptionRowPressed : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeOptionLabel,
                        selectedTimeKey === option.key ? styles.timeOptionLabelSelected : null
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
        <Text style={styles.schedulePreview}>Scheduled for {formatSchedulePreview(scheduledAt)}</Text>
      </Card>
      <Input label="Location" value={locationName} onChangeText={setLocationName} />

      <Card>
        <Text style={styles.sectionTitle}>Set the stakes</Text>
        <Text style={styles.helperText}>Play for bragging rights or make it interesting.</Text>
        <View style={styles.stakesGrid}>
          {STAKE_OPTIONS.map((option) => (
            <View key={option.type} style={styles.stakeOptionWrap}>
              <Pressable
                onPress={() => {
                  setSelectedStakeType(option.type);
                  setStakeNoteError("");
                }}
                style={({ pressed }) => [
                  styles.stakeOption,
                  selectedStakeType === option.type ? styles.stakeOptionSelected : null,
                  pressed ? styles.stakeOptionPressed : null
                ]}
              >
                <Text style={styles.stakeOptionIcon}>{option.icon}</Text>
                <View style={styles.stakeOptionText}>
                  <Text
                    style={[
                      styles.stakeOptionTitle,
                      selectedStakeType === option.type ? styles.stakeOptionTitleSelected : null
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.stakeOptionMeta,
                      selectedStakeType === option.type ? styles.stakeOptionMetaSelected : null
                    ]}
                  >
                    {option.meta}
                  </Text>
                </View>
                {selectedStakeType === option.type ? <Badge label="Selected" tone="success" /> : null}
              </Pressable>
              {selectedStakeType === option.type ? (
                <Input
                  label={option.type === "custom" ? "Describe the stakes" : "Add a note (optional)"}
                  value={stakeNote}
                  onChangeText={(value) => {
                    setStakeNote(value);
                    if (stakeNoteError) {
                      setStakeNoteError("");
                    }
                  }}
                  placeholder={option.placeholder}
                  error={option.type === "custom" ? stakeNoteError : undefined}
                />
              ) : null}
            </View>
          ))}
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={success ? (isOpenChallengeMode ? "Open Challenge Posted" : "Challenge Sent") : isOpenChallengeMode ? "Post Open Challenge" : "Send Challenge"}
        onPress={handleSubmit}
        loading={loading}
        disabled={Boolean(success)}
      />
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
  sectionTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: typography.heading,
    marginBottom: -2
  },
  label: {
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.overline
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  helperText: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: -2
  },
  pickerField: {
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pickerFieldPressed: {
    opacity: 0.95
  },
  pickerFieldLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  pickerFieldValue: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "700"
  },
  pickerContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted
  },
  calendarContainer: {
    marginTop: -2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  timeOptionsContainer: {
    marginTop: -2,
    maxHeight: 260,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  timeOptionsScroll: {
    maxHeight: 260
  },
  timeOptionsContent: {
    paddingVertical: spacing.xs
  },
  timeOptionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  timeOptionRowSelected: {
    backgroundColor: colors.primarySoft
  },
  timeOptionRowPressed: {
    opacity: 0.92
  },
  timeOptionLabel: {
    color: colors.text,
    fontWeight: "600",
    fontSize: typography.body
  },
  timeOptionLabelSelected: {
    color: colors.primary
  },
  schedulePreview: {
    color: colors.text,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: -2
  },
  sportList: {
    gap: spacing.xs,
    marginTop: 2
  },
  formatList: {
    gap: spacing.sm,
    marginTop: 2
  },
  stakesGrid: {
    gap: spacing.sm,
    marginTop: 2
  },
  stakeOptionWrap: {
    gap: spacing.xs
  },
  stakeOption: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  stakeOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6
    },
    elevation: 2
  },
  stakeOptionPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }]
  },
  stakeOptionIcon: {
    fontSize: 20
  },
  stakeOptionText: {
    flex: 1,
    gap: 2
  },
  stakeOptionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.bodyStrong
  },
  stakeOptionTitleSelected: {
    color: colors.primary
  },
  stakeOptionMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  stakeOptionMetaSelected: {
    color: colors.primary
  },
  formatOption: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  formatOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6
    },
    elevation: 2
  },
  formatOptionPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }]
  },
  formatOptionText: {
    flex: 1,
    gap: 2
  },
  formatOptionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.bodyStrong
  },
  formatOptionMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20
  },
  prefillState: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  emptyOpponentState: {
    gap: spacing.sm
  },
  opponentChoiceList: {
    gap: spacing.sm,
    marginTop: 2
  },
  opponentChoiceCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  opponentChoicePressed: {
    opacity: 0.95,
    transform: [{ scale: 0.985 }]
  },
  opponentChoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  opponentChoiceText: {
    flex: 1,
    gap: spacing.xxs
  },
  opponentChoiceTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.subheading
  },
  opponentChoiceSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  opponentIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1
  },
  emptyOpponentTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: typography.bodyStrong
  },
  selectedOpponentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted
  },
  lockedOpponentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  lockedOpponentText: {
    flex: 1,
    gap: spacing.xs
  },
  lockedOpponentName: {
    color: colors.text,
    fontWeight: "700",
    fontSize: typography.bodyStrong
  },
  prefillText: {
    color: colors.textMuted
  },
  playStyleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  playStyleTag: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  openChallengeCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted
  },
  openChallengeText: {
    flex: 1,
    gap: 2
  },
  optionHint: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  error: {
    color: colors.danger,
    fontWeight: "600"
  },
  success: {
    color: colors.success,
    fontWeight: "600"
  },
  rematchLabel: {
    color: colors.textMuted,
    fontSize: typography.body
  }
});
