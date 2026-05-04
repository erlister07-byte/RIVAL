import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_PREFIX = "rival.auth.";

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
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

async function getItem(key: string) {
  const storageKey = getStorageKey(key);

  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(storageKey) ?? null;
  }

  return SecureStore.getItemAsync(storageKey);
}

async function setItem(key: string, value: string) {
  const storageKey = getStorageKey(key);

  if (Platform.OS === "web") {
    getWebStorage()?.setItem(storageKey, value);
    return;
  }

  await SecureStore.setItemAsync(storageKey, value);
}

async function removeItem(key: string) {
  const storageKey = getStorageKey(key);

  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(storageKey);
    return;
  }

  await SecureStore.deleteItemAsync(storageKey);
}

export const supabaseAuthStorage = {
  getItem,
  setItem,
  removeItem
};
