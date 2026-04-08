export function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatSportLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
