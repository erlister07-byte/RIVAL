import { getSafeErrorPayload } from "./logger";

export type ServiceError = Error & {
  code?: string;
  details?: string;
};

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  return "code" in error && typeof error.code === "string" ? error.code : "";
}

function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const details = "details" in error && typeof error.details === "string" ? error.details : "";

  return `${message} ${details}`.trim();
}

export function getBackendDriftHint(error: unknown) {
  const code = getErrorCode(error);
  const errorText = getErrorText(error);

  if (
    code === "PGRST202"
    || errorText.includes("schema cache")
    || errorText.includes("Could not find the function public.")
  ) {
    return "This usually means the connected Supabase project is missing a required function migration.";
  }

  if (code === "42703" || errorText.includes("column") || errorText.includes("does not exist")) {
    return "This usually means the connected Supabase project is missing a required schema migration.";
  }

  return "";
}

export function getUserSafeErrorMessage(error: unknown, fallback: string) {
  const safeError = getSafeErrorPayload(error);
  const parts = [safeError.message, safeError.details].filter(Boolean);

  return parts.join(" ") || fallback;
}

export function getDiagnosticErrorMessage(error: unknown, fallback: string) {
  const baseMessage = getUserSafeErrorMessage(error, fallback);
  const backendHint = getBackendDriftHint(error);

  if (!backendHint || baseMessage.includes(backendHint)) {
    return baseMessage;
  }

  return `${baseMessage} ${backendHint}`;
}

export function toServiceError(error: unknown, fallback: string): ServiceError {
  const safeError = getSafeErrorPayload(error);
  const normalizedError = new Error(getUserSafeErrorMessage(error, fallback)) as ServiceError;

  normalizedError.code = safeError.code;
  normalizedError.details = safeError.details;

  return normalizedError;
}
