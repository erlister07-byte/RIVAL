const requiredSupabaseEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
};

const requiredFirebaseEnv = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

export type RivalAppMode = "FULL_APP" | "LOOP_01";

const appModeByEnvironmentValue: Record<string, RivalAppMode> = {
  "full-app": "FULL_APP",
  "loop-01": "LOOP_01"
};

const configuredAppMode = process.env.EXPO_PUBLIC_RIVAL_APP_MODE?.trim().toLowerCase();

export const rivalAppMode = configuredAppMode
  ? appModeByEnvironmentValue[configuredAppMode] ?? "FULL_APP"
  : "FULL_APP";

if (configuredAppMode && !appModeByEnvironmentValue[configuredAppMode] && __DEV__) {
  console.warn(
    `[runtimeConfig] Invalid EXPO_PUBLIC_RIVAL_APP_MODE value "${configuredAppMode}". Falling back to FULL_APP.`
  );
}

export const isLoopOneSandboxMode = rivalAppMode === "LOOP_01";

export const missingSupabaseEnvVars = Object.entries(requiredSupabaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const missingFirebaseEnvVars = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isSupabaseConfigured = missingSupabaseEnvVars.length === 0;
export const isBackendConfigured =
  missingSupabaseEnvVars.length === 0 && missingFirebaseEnvVars.length === 0;
