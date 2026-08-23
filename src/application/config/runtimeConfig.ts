const requiredSupabaseEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
};

export type RivalAppMode = "FULL_APP" | "LOOP_01" | "LOOP_02";

const appModeByEnvironmentValue: Record<string, RivalAppMode> = {
  "full-app": "FULL_APP",
  "loop-01": "LOOP_01",
  "loop-02": "LOOP_02"
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
export const isLoopTwoSandboxMode = rivalAppMode === "LOOP_02";

export const missingSupabaseEnvVars = Object.entries(requiredSupabaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isSupabaseConfigured = missingSupabaseEnvVars.length === 0;
export const isBackendConfigured = isSupabaseConfigured;
