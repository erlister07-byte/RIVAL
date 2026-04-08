import { useCallback, useEffect, useRef, useState } from "react";

type SuccessState = {
  title: string;
  hint?: string;
} | null;

export function useTimedSuccess(defaultDurationMs = 2800) {
  const [success, setSuccess] = useState<SuccessState>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSuccess = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setSuccess(null);
  }, []);

  const showSuccess = useCallback(
    (title: string, hint?: string, durationMs = defaultDurationMs) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setSuccess({ title, hint });
      timeoutRef.current = setTimeout(() => {
        setSuccess(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [defaultDurationMs]
  );

  useEffect(() => clearSuccess, [clearSuccess]);

  return { success, showSuccess, clearSuccess };
}
