import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import {
  AvailabilityStatus,
  Challenge,
  ChallengeType,
  Match,
  PlayStyleTag,
  Profile,
  RecentMatch,
  SkillLevel,
  SportSlug
} from "@/core/types/models";
import { getSportIdBySlug, isSportEnabled } from "@/config/sports";
import {
  acceptChallenge as acceptChallengeRecord,
  createChallenge as createChallengeRecord,
  declineChallenge as declineChallengeRecord,
  getChallengesForProfile
} from "@/services/challengeService";
import { firebaseAuth } from "@/services/firebase";
import {
  confirmMatchResult,
  getMatchesForProfile,
  rejectMatchResult,
  submitMatchResult
} from "@/services/matchService";
import { NearbyPlayer, getNearbyPlayers } from "@/services/playerService";
import {
  createUserProfile,
  getUserProfile,
  getRecentMatches,
  getProfileStats,
  updateUserProfile
} from "@/services/userService";
import { normalizeEmail } from "@/shared/lib/authValidation";
import { debugError, debugLog } from "@/shared/lib/logger";
import { toServiceError } from "@/shared/lib/serviceError";

type AuthFormInput = {
  email: string;
  password: string;
};

type OnboardingInput = {
  displayName: string;
  vancouverArea: string;
  sports: Array<{ sport: SportSlug; skillLevel: SkillLevel }>;
  challengeRadiusKm: number;
};

type ChallengeInput = {
  sport: SportSlug;
  opponentProfileId?: string;
  scheduledAt: string;
  locationName: string;
  challengeType: ChallengeType;
  stakeType?: string;
  stakeLabel?: string;
  stakeNote?: string;
  mode?: "direct" | "open";
};

type ResultInput = {
  matchId: string;
  winnerProfileId: string;
  loserProfileId: string;
  scoreSummary?: string;
  resultNotes?: string;
};

export type SessionStatus =
  | "booting"
  | "signed_out"
  | "needs_verification"
  | "needs_onboarding"
  | "authenticated";

type AppContextValue = {
  isBooting: boolean;
  isAuthenticated: boolean;
  sessionStatus: SessionStatus;
  authUser: FirebaseUser | null;
  currentUser: Profile | null;
  nearbyPlayers: NearbyPlayer[];
  challenges: Challenge[];
  matches: Match[];
  recentMatches: RecentMatch[];
  refreshHomeData: () => Promise<void>;
  signUp: (input: AuthFormInput) => Promise<void>;
  login: (input: AuthFormInput) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateAvailability: (availabilityStatus: AvailabilityStatus) => Promise<void>;
  updatePlayStyleTags: (playStyleTags: PlayStyleTag[]) => Promise<void>;
  createChallenge: (input: ChallengeInput) => Promise<Challenge>;
  respondToChallenge: (challengeId: string, status: "accepted" | "declined") => Promise<void>;
  submitResult: (input: ResultInput) => Promise<Match>;
  confirmResult: (matchId: string) => Promise<Match>;
  rejectResult: (matchId: string) => Promise<Match>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isProfileNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && error.code === "PGRST116";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    const details = "details" in error && typeof error.details === "string" ? error.details : "";
    const hint = "hint" in error && typeof error.hint === "string" ? error.hint : "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";

    const parts = [message, details, hint ? `Hint: ${hint}` : "", code ? `Code: ${code}` : ""].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return fallback;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [isHydratingProfile, setIsHydratingProfile] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [challengeReloadKey, setChallengeReloadKey] = useState(0);
  const [matchReloadKey, setMatchReloadKey] = useState(0);

  const loadChallengesForProfile = useCallback(async (profileId: string) => {
    return getChallengesForProfile(profileId);
  }, []);

  const loadMatchesForProfile = useCallback(async (profileId: string) => {
    return getMatchesForProfile(profileId);
  }, []);

  const loadRecentMatchesForProfile = useCallback(async (profileId: string) => {
    return getRecentMatches(profileId);
  }, []);

  const refreshHomeData = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }

    debugLog("[AppProvider] refreshing home data", {
      profileId: currentUser.id
    });

    const [nextChallenges, nextMatches, nextRecentMatches, nextStats] = await Promise.all([
      loadChallengesForProfile(currentUser.id),
      loadMatchesForProfile(currentUser.id),
      loadRecentMatchesForProfile(currentUser.id),
      getProfileStats(currentUser.id)
    ]);

    setChallenges(nextChallenges);
    setMatches(nextMatches);
    setRecentMatches(nextRecentMatches);
    setCurrentUser((previous) =>
      previous?.id === currentUser.id
        ? {
            ...previous,
            wins: nextStats.wins,
            losses: nextStats.losses,
            matchesPlayed: nextStats.matchesPlayed
          }
        : previous
    );
  }, [currentUser?.id, loadChallengesForProfile, loadMatchesForProfile, loadRecentMatchesForProfile]);

  const sessionStatus: SessionStatus = isBooting
    || (Boolean(authUser) && isHydratingProfile)
    ? "booting"
    : !isAuthenticated
      ? "signed_out"
      : authUser && !authUser.emailVerified
        ? "needs_verification"
      : !currentUser || !currentUser.onboardingCompleted
        ? "needs_onboarding"
        : "authenticated";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextAuthUser) => {
      debugLog("[AppProvider] auth state changed", {
        firebaseUid: nextAuthUser?.uid ?? null,
        emailVerified: nextAuthUser?.emailVerified ?? false
      });

      setIsBooting(true);
      setAuthUser(nextAuthUser);
      setIsAuthenticated(Boolean(nextAuthUser));

      if (!nextAuthUser) {
        setIsHydratingProfile(false);
        setCurrentUser(null);
        setNearbyPlayers([]);
        setChallenges([]);
        setMatches([]);
        setRecentMatches([]);
        setIsBooting(false);
        return;
      }

      try {
        setIsHydratingProfile(true);
        debugLog("[AppProvider] profile loading started", {
          firebaseUid: nextAuthUser.uid
        });
        const profile = await getUserProfile({ firebaseUid: nextAuthUser.uid });

        debugLog("[AppProvider] profile lookup completed", {
          firebaseUid: nextAuthUser.uid,
          profileFound: Boolean(profile),
          profileId: profile?.id ?? null,
          onboardingCompleted: profile?.onboardingCompleted ?? null,
          displayName: profile?.displayName ?? null,
          sportsCount: profile?.sports.length ?? 0
        });

        if (!profile) {
          setCurrentUser(null);
          setRecentMatches([]);
          return;
        }

        debugLog("[AppProvider] hydrated current user from Supabase profile", {
          firebaseUid: nextAuthUser.uid,
          profileId: profile.id,
          onboardingCompleted: profile.onboardingCompleted
        });

        setCurrentUser(profile);

        try {
          const [stats, recent] = await Promise.all([
            getProfileStats(profile.id),
            getRecentMatches(profile.id)
          ]);

          setCurrentUser((previous) =>
            previous?.id === profile.id
              ? {
                  ...previous,
                  wins: stats.wins,
                  losses: stats.losses,
                  matchesPlayed: stats.matchesPlayed
                }
              : previous
          );
          setRecentMatches(recent);
        } catch (secondaryError) {
          debugError("Failed to load profile secondary data", secondaryError, {
            firebaseUid: nextAuthUser.uid,
            profileId: profile.id
          });
        }
      } catch (error) {
        debugError("Failed to load user profile", error);
        setCurrentUser(null);
        setRecentMatches([]);
      } finally {
        setIsHydratingProfile(false);
        setIsBooting(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadChallenges() {
      if (!currentUser?.id) {
        if (isActive) {
          setChallenges([]);
        }
        return;
      }

      try {
        const nextChallenges = await loadChallengesForProfile(currentUser.id);

        if (isActive) {
          setChallenges(nextChallenges);
        }
      } catch (error) {
        debugError("Failed to load challenges", error, { profileId: currentUser.id });

        if (isActive) {
          setChallenges([]);
        }
      }
    }

    void loadChallenges();

    return () => {
      isActive = false;
    };
  }, [challengeReloadKey, currentUser?.id]);

  useEffect(() => {
    let isActive = true;

    async function loadMatches() {
      if (!currentUser?.id) {
        if (isActive) {
          setMatches([]);
        }
        return;
      }

      try {
        const nextMatches = await loadMatchesForProfile(currentUser.id);

        if (isActive) {
          setMatches(nextMatches);
        }
      } catch (error) {
        debugError("Failed to load matches", error, { profileId: currentUser.id });

        if (isActive) {
          setMatches([]);
        }
      }
    }

    void loadMatches();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, matchReloadKey]);

  useEffect(() => {
    let isActive = true;

    async function loadNearbyPlayers() {
      if (!currentUser?.id) {
        if (isActive) {
          setNearbyPlayers([]);
        }
        return;
      }

      try {
        const nextPlayers = await getNearbyPlayers(currentUser.id);

        if (isActive) {
          setNearbyPlayers(nextPlayers);
        }
      } catch (error) {
        debugError("Failed to load nearby players", error, { profileId: currentUser.id });

        if (isActive) {
          setNearbyPlayers([]);
        }
      }
    }

    void loadNearbyPlayers();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id]);

  async function signUp(input: AuthFormInput) {
    const credentials = await createUserWithEmailAndPassword(
      firebaseAuth,
      normalizeEmail(input.email),
      input.password
    );

    try {
      await sendEmailVerification(credentials.user);
    } catch (error) {
      debugError("Failed to send verification email", error, { userId: credentials.user.uid });
    }
  }

  async function login(input: AuthFormInput) {
    await signInWithEmailAndPassword(firebaseAuth, normalizeEmail(input.email), input.password);
  }

  async function logout() {
    await signOut(firebaseAuth);
  }

  async function requestPasswordReset(email: string) {
    await sendPasswordResetEmail(firebaseAuth, normalizeEmail(email));
  }

  async function resendVerificationEmail() {
    if (!firebaseAuth.currentUser) {
      throw new Error("You must be signed in to resend verification.");
    }

    await sendEmailVerification(firebaseAuth.currentUser);
  }

  async function refreshAuthUser() {
    if (!firebaseAuth.currentUser) {
      throw new Error("You must be signed in to refresh your account.");
    }

    await reload(firebaseAuth.currentUser);
    setAuthUser({ ...firebaseAuth.currentUser });
    setIsAuthenticated(Boolean(firebaseAuth.currentUser));
  }

  async function completeOnboarding(input: OnboardingInput) {
    if (!authUser?.uid) {
      throw new Error("You must be authenticated to complete onboarding.");
    }

    const liveSports = input.sports.filter((sport) => isSportEnabled(sport.sport));

    if (liveSports.length === 0) {
      throw new Error("Pickleball is the only live sport in Vancouver right now.");
    }

    const sports = liveSports.map((sport) => ({
      sportId: getSportIdBySlug(sport.sport) as number,
      skillLevel: sport.skillLevel
    }));

    let profile: Profile;

    try {
      const existingProfile = await getUserProfile({ firebaseUid: authUser.uid });
      debugLog("[AppProvider] completeOnboarding profile lookup", {
        firebaseUid: authUser.uid,
        existingProfileId: existingProfile?.id ?? null,
        existingOnboardingCompleted: existingProfile?.onboardingCompleted ?? null
      });
      if (existingProfile) {
        debugLog("[AppProvider] updating existing profile during onboarding", {
          firebaseUid: authUser.uid,
          profileId: existingProfile.id
        });
        profile = await updateUserProfile(existingProfile.id, {
          displayName: input.displayName,
          vancouverArea: input.vancouverArea,
          challengeRadiusKm: input.challengeRadiusKm,
          onboardingCompleted: true,
          sports
        });
      } else {
        debugLog("[AppProvider] creating new profile during onboarding", {
          firebaseUid: authUser.uid
        });
        profile = await createUserProfile({
          firebaseUid: authUser.uid,
          email: authUser.email ?? "",
          displayName: input.displayName,
          vancouverArea: input.vancouverArea,
          challengeRadiusKm: input.challengeRadiusKm,
          onboardingCompleted: true,
          sports
        });
      }
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to update onboarding."));
    }

    const stats = await getProfileStats(profile.id);
    setCurrentUser({
      ...profile,
      wins: stats.wins,
      losses: stats.losses,
      matchesPlayed: stats.matchesPlayed
    });
    setRecentMatches(await getRecentMatches(profile.id));
  }

  async function createChallenge(input: ChallengeInput) {
    if (!currentUser) {
      throw new Error("You must be logged in to create a challenge.");
    }

    try {
      const challenge = await createChallengeRecord({
        sportId: getSportIdBySlug(input.sport) as number,
        challengerProfileId: currentUser.id,
        opponentProfileId: input.opponentProfileId,
        scheduledAt: input.scheduledAt,
        locationName: input.locationName,
        challengeType: input.challengeType,
        stakeType: input.stakeType ?? undefined,
        stakeLabel: input.stakeLabel ?? undefined,
        stakeNote: input.stakeNote ?? null,
        isOpen: input.mode === "open"
      });

      setChallenges((previous) => [challenge, ...previous]);
      setChallengeReloadKey((value) => value + 1);
      return challenge;
    } catch (error) {
      debugError("[AppProvider] createChallenge failed", error, {
        currentUserProfileId: currentUser.id,
        opponentProfileId: input.opponentProfileId ?? null,
        sport: input.sport
      });
      throw toServiceError(error, "Unable to create challenge right now.");
    }
  }

  async function updateAvailability(availabilityStatus: AvailabilityStatus) {
    if (!currentUser) {
      throw new Error("You must be logged in to update availability.");
    }

    try {
      const updatedProfile = await updateUserProfile(currentUser.id, { availabilityStatus });

      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              availabilityStatus: updatedProfile.availabilityStatus
            }
          : previous
      );
    } catch (error) {
      debugError("[AppProvider] updateAvailability failed", error, {
        currentUserProfileId: currentUser.id,
        availabilityStatus
      });
      throw toServiceError(error, "Unable to update availability right now.");
    }
  }

  async function updatePlayStyleTags(playStyleTags: PlayStyleTag[]) {
    if (!currentUser) {
      throw new Error("You must be logged in to update play style.");
    }

    try {
      const updatedProfile = await updateUserProfile(currentUser.id, { playStyleTags });

      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              playStyleTags: updatedProfile.playStyleTags
            }
          : previous
      );
      setNearbyPlayers((previous) =>
        previous.map((player) =>
          player.id === currentUser.id ? { ...player, playStyleTags: updatedProfile.playStyleTags } : player
        )
      );
    } catch (error) {
      debugError("[AppProvider] updatePlayStyleTags failed", error, {
        currentUserProfileId: currentUser.id,
        playStyleTags
      });
      throw toServiceError(error, "Unable to update play style right now.");
    }
  }

  async function respondToChallenge(challengeId: string, status: "accepted" | "declined") {
    try {
      await sleep(300);

      if (status === "accepted") {
        await acceptChallengeRecord(challengeId);
        setMatchReloadKey((value) => value + 1);
      } else {
        await declineChallengeRecord(challengeId);
      }

      setChallengeReloadKey((value) => value + 1);
    } catch (error) {
      debugError("[AppProvider] respondToChallenge failed", error, {
        challengeId,
        status,
        currentUserProfileId: currentUser?.id ?? null
      });
      throw toServiceError(
        error,
        status === "accepted" ? "Unable to accept challenge right now." : "Unable to decline challenge right now."
      );
    }
  }

  async function submitResult(input: ResultInput) {
    if (!currentUser) {
      throw new Error("You must be logged in to submit a result.");
    }

    debugLog("[AppProvider] submitResult called", {
      currentUserProfileId: currentUser.id,
      matchId: input.matchId,
      winnerProfileId: input.winnerProfileId,
      loserProfileId: input.loserProfileId
    });

    try {
      const submittedMatch = await submitMatchResult({
        matchId: input.matchId,
        submittedByProfileId: currentUser.id,
        winnerProfileId: input.winnerProfileId,
        loserProfileId: input.loserProfileId,
        scoreSummary: input.scoreSummary ?? null,
        resultNotes: input.resultNotes ?? null
      });

      debugLog("[AppProvider] submitResult returned", {
        matchId: submittedMatch.id,
        resultStatus: submittedMatch.resultStatus,
        submittedByProfileId: submittedMatch.submittedByProfileId,
        winnerProfileId: submittedMatch.winnerProfileId,
        loserProfileId: submittedMatch.loserProfileId
      });

      setMatches((previous) => {
        const next = previous.map((match) =>
          match.id === submittedMatch.id ? submittedMatch : match
        );

        return next.some((match) => match.id === submittedMatch.id)
          ? next
          : [submittedMatch, ...next];
      });
      setMatchReloadKey((value) => value + 1);

      return submittedMatch;
    } catch (error) {
      debugError("[AppProvider] submitResult failed", error, {
        currentUserProfileId: currentUser.id,
        matchId: input.matchId
      });
      throw toServiceError(error, "Unable to record the match result.");
    }
  }

  async function confirmResult(matchId: string) {
    if (!currentUser) {
      throw new Error("You must be logged in to confirm a result.");
    }

    debugLog("[AppProvider] confirmResult called", {
      currentUserProfileId: currentUser.id,
      matchId
    });

    try {
      const confirmedMatch = await confirmMatchResult(matchId, currentUser.id);

      setMatches((previous) => {
        const next = previous.map((item) => (item.id === confirmedMatch.id ? confirmedMatch : item));
        return next.some((item) => item.id === confirmedMatch.id) ? next : [confirmedMatch, ...next];
      });

      setChallenges((previous) =>
        previous.map((item) =>
          item.id === confirmedMatch.challengeId ? { ...item, status: "completed" } : item
        )
      );
      setChallengeReloadKey((value) => value + 1);
      setMatchReloadKey((value) => value + 1);

      debugLog("[AppProvider] reloading stats after confirm", {
        currentUserProfileId: currentUser.id,
        matchId,
        winnerProfileId: confirmedMatch.winnerProfileId,
        loserProfileId: confirmedMatch.loserProfileId
      });
      const stats = await getProfileStats(currentUser.id);
      debugLog("[AppProvider] stats reload after confirm", {
        currentUserProfileId: currentUser.id,
        wins: stats.wins,
        losses: stats.losses,
        matchesPlayed: stats.matchesPlayed
      });
      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              wins: stats.wins,
              losses: stats.losses,
              matchesPlayed: stats.matchesPlayed
            }
          : previous
      );
      const nextRecentMatches = await getRecentMatches(currentUser.id);
      debugLog("[AppProvider] recent matches reload after confirm", {
        currentUserProfileId: currentUser.id,
        recentMatchCount: nextRecentMatches.length
      });
      setRecentMatches(nextRecentMatches);

      return confirmedMatch;
    } catch (error) {
      debugError("[AppProvider] confirmResult failed", error, {
        currentUserProfileId: currentUser.id,
        matchId
      });
      throw toServiceError(error, "Unable to confirm result.");
    }
  }

  async function rejectResult(matchId: string) {
    if (!currentUser) {
      throw new Error("You must be logged in to reject a result.");
    }

    try {
      const disputedMatch = await rejectMatchResult(matchId, currentUser.id);

      setMatches((previous) => {
        const next = previous.map((item) => (item.id === disputedMatch.id ? disputedMatch : item));
        return next.some((item) => item.id === disputedMatch.id) ? next : [disputedMatch, ...next];
      });
      setMatchReloadKey((value) => value + 1);

      return disputedMatch;
    } catch (error) {
      debugError("[AppProvider] rejectResult failed", error, {
        currentUserProfileId: currentUser.id,
        matchId
      });
      throw toServiceError(error, "Unable to dispute result.");
    }
  }

  const value = useMemo(
    () => ({
      isBooting,
      isAuthenticated,
      sessionStatus,
      authUser,
      currentUser,
      nearbyPlayers,
      challenges,
      matches,
      recentMatches,
      refreshHomeData,
      signUp,
      login,
      logout,
      requestPasswordReset,
      resendVerificationEmail,
      refreshAuthUser,
      completeOnboarding,
      updateAvailability,
      updatePlayStyleTags,
      createChallenge,
      respondToChallenge,
      submitResult,
      confirmResult,
      rejectResult
    }),
    [
      authUser,
      challenges,
      currentUser,
      isAuthenticated,
      isBooting,
      matches,
      nearbyPlayers,
      updateAvailability,
      updatePlayStyleTags,
      refreshAuthUser,
      requestPasswordReset,
      recentMatches,
      refreshHomeData,
      resendVerificationEmail,
      sessionStatus
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }

  return context;
}
