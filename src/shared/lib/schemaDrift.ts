export function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return code === "42703" && message.includes(columnName);
}

// Use this only for display-oriented fields that can safely degrade while a manual
// Supabase migration is still pending in production.
export function withOptionalFieldFallback<T>(value: T | null | undefined, fallback: T) {
  return value ?? fallback;
}
