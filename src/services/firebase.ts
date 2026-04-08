import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, browserLocalPersistence, getAuth, initializeAuth } from "firebase/auth";
import { Platform } from "react-native";

import { firebaseSecurePersistence } from "@/services/authStorage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

function assertFirebaseConfig() {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(`Missing Firebase config: ${missingKeys.join(", ")}`);
  }
}

function initializeFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  assertFirebaseConfig();
  return initializeApp(firebaseConfig);
}

export const firebaseApp = initializeFirebaseApp();

function initializeFirebaseAuth(): Auth {
  try {
    if (Platform.OS === "web") {
      return initializeAuth(firebaseApp, {
        persistence: browserLocalPersistence
      });
    }

    return initializeAuth(firebaseApp, {
      persistence: firebaseSecurePersistence
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth: Auth = initializeFirebaseAuth();
