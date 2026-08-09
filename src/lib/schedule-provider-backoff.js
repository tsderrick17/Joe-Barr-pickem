export function scheduleProviderCooldownMinutes(consecutiveFailures) {
  if (consecutiveFailures <= 1) return 120;
  if (consecutiveFailures === 2) return 360;
  if (consecutiveFailures === 3) return 720;
  return 1_440;
}
