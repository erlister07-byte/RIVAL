import { getSafeErrorPayload } from "./logger";

export type ServiceError = Error & {
  code?: string;
  details?: string;
};

export function getUserSafeErrorMessage(error: unknown, fallback: string) {
  const safeError = getSafeErrorPayload(error);
  const parts = [safeError.message, safeError.details].filter(Boolean);

  return parts.join(" ") || fallback;
}

export function toServiceError(error: unknown, fallback: string): ServiceError {
  const safeError = getSafeErrorPayload(error);
  const normalizedError = new Error(getUserSafeErrorMessage(error, fallback)) as ServiceError;

  normalizedError.code = safeError.code;
  normalizedError.details = safeError.details;

  return normalizedError;
}
