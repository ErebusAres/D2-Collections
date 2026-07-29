export function formatUtcAndLocalTime(
  value: string,
  localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  const date = new Date(value);
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  };
  const utc = date.toLocaleTimeString([], { ...options, timeZone: "UTC" });
  const local = date.toLocaleTimeString([], { ...options, timeZone: localTimeZone });
  return local === utc ? utc : `${utc} / ${local}`;
}
