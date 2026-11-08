const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string) {
  if (!value.trim()) {
    return "Email is required.";
  }

  if (!EMAIL_PATTERN.test(normalizeEmail(value))) {
    return "Enter a valid email address.";
  }

  return "";
}

export function validatePassword(value: string) {
  if (!value) {
    return "Password is required.";
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Use at least one letter and one number.";
  }

  return "";
}

export function getAuthErrorMessage(error: unknown, action: "login" | "signup" | "reset") {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";

  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  switch (code) {
    // Supabase Auth error codes.
    case "user_already_exists":
    case "auth/email-already-in-use":
      return "That email is already in use.";
    case "email_address_invalid":
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "invalid_credentials":
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return action === "login"
        ? "Invalid email or password."
        : "We couldn't verify that account.";
    case "weak_password":
    case "auth/weak-password":
      return "Use a stronger password with at least 8 characters, including a number.";
    case "over_email_send_rate_limit":
      return "Too many verification emails were sent. Please wait a few minutes and try again.";
    case "over_request_rate_limit":
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "signup_disabled":
      return "New account registration is temporarily unavailable.";
    case "email_address_not_authorized":
      return "That email address is not authorized to create an account.";
    default:
      // Fetch failures from supabase-js do not always include an Auth error code.
      if (message.includes("network request failed") || message.includes("failed to fetch")) {
        return "Network error. Check your connection and try again.";
      }

      if (action === "signup") {
        return "Unable to create your account right now.";
      }

      if (action === "reset") {
        return "Unable to send a reset email right now.";
      }

      return "Unable to log in right now.";
  }
}
