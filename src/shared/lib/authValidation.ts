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

  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already in use.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return action === "login"
        ? "Invalid email or password."
        : "We couldn't verify that account.";
    case "auth/weak-password":
      return "Use a stronger password with at least 8 characters, including a number.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      if (action === "signup") {
        return "Unable to create your account right now.";
      }

      if (action === "reset") {
        return "Unable to send a reset email right now.";
      }

      return "Unable to log in right now.";
  }
}
