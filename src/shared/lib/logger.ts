export function getSafeErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : undefined;
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    const details = "details" in error && typeof error.details === "string" ? error.details : undefined;

    return {
      message,
      code,
      details
    };
  }

  return { message: typeof error === "string" ? error : "Unknown error" };
}

export function debugLog(message: string, context?: Record<string, unknown>) {
  if (!__DEV__) {
    return;
  }

  if (context) {
    console.log(message, context);
    return;
  }

  console.log(message);
}

export function debugError(message: string, error?: unknown, context?: Record<string, unknown>) {
  if (!__DEV__) {
    return;
  }

  const payload = {
    ...(context ?? {}),
    ...(error === undefined ? {} : { error: getSafeErrorPayload(error) })
  };

  console.error(message, payload);
}
