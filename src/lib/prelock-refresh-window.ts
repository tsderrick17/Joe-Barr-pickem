import { dateFormat } from "./date-format.js";

export function isEasternPrelockRefreshWindow(now = new Date()) {
  const hour = dateFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(now);

  return Number(hour) === 7;
}
