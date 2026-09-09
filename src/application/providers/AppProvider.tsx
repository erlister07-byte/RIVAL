import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";

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
import { isLoopOneSandboxMode, isLoopTwoSandboxMode } from "@/application/config/runtimeConfig";
import { getSportIdBySlug, isSportEnabled } from "@/config/sports";
import {
  createChallenge as createChallengeRecord,
  getChallengesForProfile,
  respondToLoopTwoChallenge
} from "@/services/challengeService";
import { supabase } from "@/services/supabaseClient";
import {
  confirmMatchResult,
  getRecentMatches,
  getMatchesForProfile,
  rejectMatchResult,
  submitMatchResult
} from "@/services/matchService";
import { NearbyPlayer, getNearbyPlayers } from "@/services/playerService";
import {
  createUserProfile,
  getCurrentUserProfile,
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
  resultOutcome?: "win" | "draw";
  winnerProfileId?: string;
  loserProfileId?: string;
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
  isHydratingProfile: boolean;
  isAuthenticated: boolean;
  sessionStatus: SessionStatus;
  authUser: User | null;
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
  const [authUser, setAuthUser] = useState<User | null>(null);
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
    if (isLoopOneSandboxMode || isLoopTwoSandboxMode || !currentUser?.id) {
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
            draws: nextStats.draws,
            matchesPlayed: nextStats.matchesPlayed,
            xp: nextStats.xp
          }
        : previous
    );
  }, [currentUser?.id, loadChallengesForProfile, loadMatchesForProfile, loadRecentMatchesForProfile]);

  const sessionStatus: SessionStatus = isBooting
    || (Boolean(authUser) && isHydratingProfile)
    ? "booting"
    : !isAuthenticated
      ? "signed_out"
      : authUser && !authUser.email_confirmed_at
        ? "needs_verification"
      : !currentUser || !currentUser.onboardingCompleted
        ? "needs_onboarding"
        : "authenticated";

  useEffect(() => {
    let isActive = true;
    let hydrationVersion = 0;
    let activeAuthUserId: string | null = null;
    let hydratingAuthUserId: string | null = null;
    let hydratedAuthUserId: string | null = null;

    function clearSessionUser() {
      hydrationVersion += 1;
      activeAuthUserId = null;
      hydratingAuthUserId = null;
      hydratedAuthUserId = null;
      setAuthUser(null);
      setIsAuthenticated(false);
      setIsHydratingProfile(false);
      setCurrentUser(null);
      setNearbyPlayers([]);
      setChallenges([]);
      setMatches([]);
      setRecentMatches([]);
      setIsBooting(false);
    }

    async function hydrateSessionUser(nextAuthUser: User) {
      const nextHydrationVersion = ++hydrationVersion;
      activeAuthUserId = nextAuthUser.id;
      hydratingAuthUserId = nextAuthUser.id;
      hydratedAuthUserId = null;

      debugLog("[AppProvider] auth state changed", {
        authUserId: nextAuthUser.id,
        emailVerified: Boolean(nextAuthUser.email_confirmed_at)
      });

      setIsBooting(true);
      setAuthUser(nextAuthUser);
      setIsAuthenticated(true);

      try {
        setIsHydratingProfile(true);
        debugLog("[AppProvider] profile loading started", {
          authUserId: nextAuthUser.id
        });
        const profile = await getCurrentUserProfile();

        if (!isActive || nextHydrationVersion !== hydrationVersion) {
          return;
        }

        debugLog("[AppProvider] profile lookup completed", {
          authUserId: nextAuthUser.id,
          profileFound: Boolean(profile),
          profileId: profile?.id ?? null,
          onboardingCompleted: profile?.onboardingCompleted ?? null,
          displayName: profile?.displayName ?? null,
          sportsCount: profile?.sports.length ?? 0
        });
        hydratedAuthUserId = nextAuthUser.id;

        if (!profile) {
          setCurrentUser(null);
          setRecentMatches([]);
          return;
        }

        debugLog("[AppProvider] hydrated current user from Supabase profile", {
          authUserId: nextAuthUser.id,
          profileId: profile.id,
          onboardingCompleted: profile.onboardingCompleted
        });

        setCurrentUser(profile);

        if (isLoopOneSandboxMode || isLoopTwoSandboxMode) {
          setRecentMatches([]);
        } else {
          try {
            const [stats, recent] = await Promise.all([
              getProfileStats(profile.id),
              getRecentMatches(profile.id)
            ]);

            if (!isActive || nextHydrationVersion !== hydrationVersion) {
              return;
            }

            setCurrentUser((previous) =>
              previous?.id === profile.id
                ? {
                    ...previous,
                    wins: stats.wins,
                    losses: stats.losses,
                    draws: stats.draws,
                    matchesPlayed: stats.matchesPlayed,
                    xp: stats.xp
                  }
                : previous
            );
            setRecentMatches(recent);
          } catch (secondaryError) {
            debugError("Failed to load profile secondary data", secondaryError, {
              authUserId: nextAuthUser.id,
              profileId: profile.id
            });
          }
        }
      } catch (error) {
        if (!isActive || nextHydrationVersion !== hydrationVersion) {
          return;
        }

        debugError("Failed to load user profile", error);
        setCurrentUser(null);
        setRecentMatches([]);
      } finally {
        if (isActive && nextHydrationVersion === hydrationVersion) {
          hydratingAuthUserId = null;
          setIsHydratingProfile(false);
          setIsBooting(false);
        }
      }
    }

    function handleAuthStateChange(event: AuthChangeEvent, nextAuthUser: User | null) {
      switch (event) {
        case "SIGNED_OUT":
          clearSessionUser();
          return;
        case "INITIAL_SESSION":
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
        case "PASSWORD_RECOVERY":
        case "MFA_CHALLENGE_VERIFIED":
          if (!nextAuthUser) {
            clearSessionUser();
            return;
          }
      }

      const isSameActiveUser = activeAuthUserId === nextAuthUser.id;
      const isHydratedOrHydrating =
        hydratedAuthUserId === nextAuthUser.id || hydratingAuthUserId === nextAuthUser.id;

      if (isSameActiveUser && isHydratedOrHydrating) {
        setAuthUser(nextAuthUser);
        setIsAuthenticated(true);
        return;
      }

      void hydrateSessionUser(nextAuthUser);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Run profile queries after the auth callback releases Supabase's internal lock.
      setTimeout(() => {
        if (isActive) {
          handleAuthStateChange(event, session?.user ?? null);
        }
      }, 0);
    });

    return () => {
      isActive = false;
      hydrationVersion += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadChallenges() {
      if (isLoopOneSandboxMode || isLoopTwoSandboxMode) {
        if (isActive) {
          setChallenges([]);
        }
        return;
      }

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
      if (isLoopOneSandboxMode || isLoopTwoSandboxMode) {
        if (isActive) {
          setMatches([]);
        }
        return;
      }

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
      if (isLoopOneSandboxMode || isLoopTwoSandboxMode) {
        if (isActive) {
          setNearbyPlayers([]);
        }
        return;
      }

      if (!currentUser?.id || !currentUser.onboardingCompleted) {
        if (isActive) {
          setNearbyPlayers([]);
        }

        if (currentUser?.id && !currentUser.onboardingCompleted) {
          debugLog("[AppProvider] skipping nearby players until profile onboarding is complete", {
            profileId: currentUser.id
          });
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
  }, [currentUser?.id, currentUser?.onboardingCompleted]);

  async function signUp(input: AuthFormInput) {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password
    });

    if (error) {
      throw error;
    }
  }

  async function login(input: AuthFormInput) {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password
    });

    if (error) {
      throw error;
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
    if (error) throw error;
  }

  async function resendVerificationEmail() {
    if (!authUser?.email) {
      throw new Error("You must be signed in to resend verification.");
    }

    const { error } = await supabase.auth.resend({ type: "signup", email: authUser.email });
    if (error) throw error;
  }

  async function refreshAuthUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("You must be signed in to refresh your account.");
    }

    setAuthUser(data.user);
    setIsAuthenticated(true);
  }

  async function completeOnboarding(input: OnboardingInput) {
    if (!authUser?.id) {
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
      debugLog("[AppProvider] upserting profile during onboarding", {
        authUserId: authUser.id,
        onboardingCompleted: true
      });
      profile = await createUserProfile({
        authUserId: authUser.id,
        email: authUser.email ?? "",
        displayName: input.displayName,
        vancouverArea: input.vancouverArea,
        challengeRadiusKm: input.challengeRadiusKm,
        onboardingCompleted: true,
        sports
      });
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to update onboarding."));
    }

    if (isLoopOneSandboxMode) {
      setCurrentUser(profile);
      setRecentMatches([]);
      return;
    }

    const stats = await getProfileStats(profile.id);
    setCurrentUser({
      ...profile,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      matchesPlayed: stats.matchesPlayed,
      xp: stats.xp
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

      await respondToLoopTwoChallenge(
        challengeId,
        status === "accepted" ? "accept" : "decline"
      );

      if (status === "accepted") {
        setMatchReloadKey((value) => value + 1);
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
      resultOutcome: input.resultOutcome ?? "win",
      winnerProfileId: input.winnerProfileId,
      loserProfileId: input.loserProfileId
    });

    try {
      const submittedMatch = await submitMatchResult({
        matchId: input.matchId,
        submittedByProfileId: currentUser.id,
        resultOutcome: input.resultOutcome,
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
        draws: stats.draws,
        matchesPlayed: stats.matchesPlayed,
        xp: stats.xp
      });
      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              wins: stats.wins,
              losses: stats.losses,
              draws: stats.draws,
              matchesPlayed: stats.matchesPlayed,
              xp: stats.xp
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
      isHydratingProfile,
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
      isHydratingProfile,
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
