export function isEasternPrelockRefreshWindow(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(now);

  return Number(hour) === 7;
}
