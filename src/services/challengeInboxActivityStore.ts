import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_PREFIX = "rival.challenge_inbox.";

function getStorageKey(profileId: string) {
  return `${STORAGE_PREFIX}${profileId}.last_viewed_at`;
}

function getWebStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getChallengeInboxLastViewedAt(profileId: string) {
  const storageKey = getStorageKey(profileId);

  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(storageKey) ?? null;
  }

  return SecureStore.getItemAsync(storageKey);
}

export async function markChallengeInboxViewed(profileId: string, viewedAt = new Date().toISOString()) {
  const storageKey = getStorageKey(profileId);

  if (Platform.OS === "web") {
    getWebStorage()?.setItem(storageKey, viewedAt);
    return viewedAt;
  }

  await SecureStore.setItemAsync(storageKey, viewedAt);
  return viewedAt;
}
