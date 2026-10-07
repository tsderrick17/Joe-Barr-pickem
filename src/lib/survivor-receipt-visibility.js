// @ts-check
/**
 * Whether the Survivor section is part of the Slate receipt for a week.
 *
 * It stays while the player is still in the pool, and through the week they
 * are knocked out. Once a champion is crowned it stays for the week the
 * crowning happens in, then leaves for everyone. In every other case the
 * receipt is the shorter, centered Pick'em ticket until the next season.
 * @param {{ periodType: "regular" | "playoff", available: boolean, requiredThisPeriod: boolean, championCrownedAt: string | null, periodFirstKickoffAt?: string | null }} receipt
 */
export function shouldShowSurvivorOnReceipt({
  periodType,
  available,
  requiredThisPeriod,
  championCrownedAt,
  periodFirstKickoffAt,
}) {
  if (periodType !== "regular" || !available) return false;
  if (!championCrownedAt) return Boolean(requiredThisPeriod);
  const crowned = Date.parse(championCrownedAt);
  const firstKickoff = Date.parse(periodFirstKickoffAt ?? "");
  if (!Number.isFinite(crowned) || !Number.isFinite(firstKickoff)) return false;
  return crowned >= firstKickoff;
}
