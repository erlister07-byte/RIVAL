const listeners = new Set<() => void>();

export function notifySocialUiChanged() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSocialUiChanges(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
