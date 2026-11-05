// How often the score worker checks for finals, as three tiers. Normal is the full ladder (score-retry-ladder.js). Past LOW_BALANCE_USED_CREDITS
// used in the month the worker switches to Lean or Minimal to make the Odds API allowance last, and it pauses only when what is left would
// not even cover the official lines. Each tier is a list of times after kickoff, not a list of gaps, so a game that is mid-ladder when the tier
// changes goes straight to the next time on the new list: nothing is skipped and nothing is checked twice.
import { SCORE_GATE_INTERVAL_MINUTES, SCORE_RETRY_MINUTES } from "./score-retry-ladder.js";
import { FINAL_SCORE_POLLING_LIMIT_HOURS, FIRST_SCORE_CHECK_DELAY_MINUTES } from "./score-window.js";

const MINUTE = 60_000;
const TICK = SCORE_GATE_INTERVAL_MINUTES * MINUTE;

/**
 * Credits used in the month at which Normal ends (of the plan's 500). Nothing lighter than Normal runs below it, however the forecast looks:
 * the owner wants the full ladder for as long as the month has room. The Odds API allowance renews on the 1st (UTC), so a reading from an
 * earlier month does not count (see chooseScoreTier).
 */
export const LOW_BALANCE_USED_CREDITS = 440;

/** Credits kept beyond the forecast official-line requests, so a day with one extra lock fetch does not strand a line. */
export const LINE_NEED_CUSHION_CREDITS = 5;

/** A paused game is looked at again this often, to notice the balance recovering (a new month) without waking the worker every tick. */
export const PAUSED_RECHECK_MINUTES = 60;

/** Normal first, then the lighter tiers in order. "paused" is not a schedule: it is what happens when no tier is affordable. */
export const SCORE_TIERS = Object.freeze(["normal", "lean", "minimal"]);

export const SCORE_TIER_SCHEDULES = Object.freeze({
  normal: Object.freeze({ label: "Normal", firstCheckMinutes: FIRST_SCORE_CHECK_DELAY_MINUTES, gapMinutes: SCORE_RETRY_MINUTES }),
  lean: Object.freeze({ label: "Lean", firstCheckMinutes: FIRST_SCORE_CHECK_DELAY_MINUTES, gapMinutes: Object.freeze([15, 15, 15, 15, 15, 15, 60, 120, 240]) }),
  minimal: Object.freeze({ label: "Minimal", firstCheckMinutes: 190, gapMinutes: Object.freeze([20, 20, 20, 60, 120, 240]) }),
});

const roundUpToTick = (ms) => Math.ceil(ms / TICK) * TICK;
const floorToTick = (ms) => Math.floor(ms / TICK) * TICK;

/** Minutes after kickoff of every check on a tier: the first, then each gap added on. Off the 5-minute grid is handled by tierCheckTimes. */
export function tierCheckOffsets(tier) {
  const { firstCheckMinutes, gapMinutes } = SCORE_TIER_SCHEDULES[tier];
  const offsets = [firstCheckMinutes];
  for (const gap of gapMinutes) offsets.push(offsets.at(-1) + gap);
  return offsets;
}

/** The instants (ms) a game kicking off at `kickoffMs` is checked on this tier, each rounded up to the worker's tick. */
export function tierCheckTimes(tier, kickoffMs) {
  return tierCheckOffsets(tier).map((minutes) => roundUpToTick(kickoffMs + minutes * MINUTE));
}

/** The first check on the tier strictly after `afterMs` (a tick), or null once the list is spent. */
export function nextTierCheckMs(tier, kickoffMs, afterMs = -Infinity) {
  return tierCheckTimes(tier, kickoffMs).find((time) => time > afterMs) ?? null;
}

/**
 * Whether a game's next check on `tier` has arrived. `lastCheckedMs` is when it was last really checked (null if it never was), and counts
 * from the tick that run was called for, so a run a few seconds after its tick does not push the game a tick later.
 */
export function isTierCheckDue(tier, kickoffMs, lastCheckedMs, nowMs) {
  const next = nextTierCheckMs(tier, kickoffMs, lastCheckedMs === null ? -Infinity : floorToTick(lastCheckedMs));
  return next !== null && next <= nowMs;
}

/**
 * When a game that has just been looked at (checked, or deliberately passed over) may be looked at again: the next time on its tier, or
 * PAUSED_RECHECK_MINUTES on when polling is paused. After the tier's last time there are no more automatic checks, so the timer is
 * set as far out as polling itself ends and the database gate never wakes the worker for that game again. Returns an ISO string.
 */
export function nextScoreCheckTime(tier, kickoffMs, nowMs) {
  const tick = floorToTick(nowMs);
  if (tier === "paused") return new Date(tick + PAUSED_RECHECK_MINUTES * MINUTE).toISOString();
  const next = nextTierCheckMs(tier, kickoffMs, tick);
  return new Date(next ?? tick + FINAL_SCORE_POLLING_LIMIT_HOURS * 60 * MINUTE).toISOString();
}

/** The place of a check on its tier's list: how many of the tier's times have arrived (at least 1). The chart's "window" for a game found final. */
export function tierRung(tier, kickoffMs, nowMs) {
  const tick = floorToTick(nowMs);
  return Math.max(1, tierCheckTimes(tier, kickoffMs).filter((time) => time <= tick).length);
}

/** What a run records as its ladder: the current version for Normal, a tier-suffixed one otherwise, so the rung chart counts Normal only. */
export function ladderVersionForTier(version, tier) {
  return tier === "normal" ? version : `${version}:${tier}`;
}

const credits = (value) => `${Math.round(value)} credit${Math.round(value) === 1 ? "" : "s"}`;

/**
 * Which tier to run, from the month's usage and what the rest of the month needs. Pure: the caller prices the rest of the month.
 *  - usedCredits / remainingCredits: the provider's latest reading in the month (null if none this month).
 *  - lineNeedCredits: what the rest of the month's official-line requests will cost, with the cushion.
 *  - leanNeedCredits / minimalNeedCredits: what score checks for every game day left would cost on each tier.
 * Normal while under LOW_BALANCE_USED_CREDITS used, or when the usage is unknown. From there Lean if its forecast fits in what is left after
 * the lines, otherwise Minimal, and "paused" only when nothing is left after the lines. It is decided afresh every run, so it can step back up.
 */
export function chooseScoreTier({ usedCredits, remainingCredits, lineNeedCredits, leanNeedCredits, minimalNeedCredits, gameDaysLeft = 0 }) {
  const base = { usedCredits, remainingCredits, lineNeedCredits, leanNeedCredits, minimalNeedCredits, gameDaysLeft, lowBalanceAt: LOW_BALANCE_USED_CREDITS };
  if (usedCredits === null || usedCredits === undefined || remainingCredits === null || remainingCredits === undefined) {
    return { ...base, tier: "normal", spendableCredits: null, message: `Normal: no credit reading yet this month. Slower checking would start at ${LOW_BALANCE_USED_CREDITS} credits used.` };
  }
  if (usedCredits < LOW_BALANCE_USED_CREDITS) {
    return { ...base, tier: "normal", spendableCredits: null, message: `Normal: ${usedCredits} credits used. Slower checking would start at ${LOW_BALANCE_USED_CREDITS}.` };
  }
  const spendableCredits = remainingCredits - lineNeedCredits;
  const days = `${gameDaysLeft} game day${gameDaysLeft === 1 ? "" : "s"}`;
  if (spendableCredits <= 0) {
    return { ...base, tier: "paused", spendableCredits, message: `Paused: ${credits(remainingCredits)} left and the rest of the month's official lines need about ${credits(lineNeedCredits)}. The Run score check now button still works.` };
  }
  if (leanNeedCredits <= spendableCredits) {
    return { ...base, tier: "lean", spendableCredits, message: `Lean: ${credits(spendableCredits)} are free for scores after the lines, and Lean needs about ${credits(leanNeedCredits)} for the ${days} left.` };
  }
  return { ...base, tier: "minimal", spendableCredits, message: `Minimal: ${credits(spendableCredits)} are free for scores after the lines, and Lean would need about ${credits(leanNeedCredits)} for the ${days} left.` };
}
