import { SocialServiceError } from "@/services/socialService";

export function getSocialUiError(error: unknown): string {
  if (error instanceof SocialServiceError) {
    if (error.code === "cooldown") return "Please wait before sending another friend request.";
    if (error.code === "not_found_or_unavailable") return "This player or relationship is unavailable.";
    if (error.code === "unauthenticated") return "Please sign in again and retry.";
  }
  return "Unable to update friendship right now. Please retry.";
}
