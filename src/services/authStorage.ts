import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Persistence } from "firebase/auth";

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

type FirebasePersistenceAdapter = Persistence & {
  _isAvailable: () => Promise<boolean>;
  _set: (key: string, value: string) => Promise<void>;
  _get: <T>(key: string) => Promise<T | null>;
  _remove: (key: string) => Promise<void>;
  _addListener: (_key: string, _listener: () => void) => void;
  _removeListener: (_key: string, _listener: () => void) => void;
};

const firebaseSecurePersistenceAdapter: FirebasePersistenceAdapter = {
  type: "LOCAL",
  async _isAvailable() {
    if (Platform.OS === "web") {
      return getWebStorage() !== null;
    }

    return true;
  },
  async _set(key, value) {
    await setItem(key, value);
  },
  async _get<T>(key: string): Promise<T | null> {
    const value = await getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  },
  async _remove(key) {
    await removeItem(key);
  },
  _addListener() {},
  _removeListener() {}
};

export const firebaseSecurePersistence = firebaseSecurePersistenceAdapter as Persistence;
