// Both seasons use the same predictable post-kickoff ladder: the first check is FIRST_SCORE_CHECK_DELAY_MINUTES after kickoff (score-window.js),
// then seven 5-minute gaps, two 10-minute gaps, three 20-minute gaps and the emergency gaps of 60, 120 and 240 minutes. After the last gap there
// are no more automatic checks (the overdue alert and the Commissioner's button take over). The worker's tick is SCORE_GATE_INTERVAL_MINUTES,
// so every gap here is a real gap in wall-clock time. The score worker and the Commissioner's credit charts both read it from here, so a
// change reaches both.
export const SCORE_RETRY_MINUTES = Object.freeze([5, 5, 5, 5, 5, 5, 5, 10, 10, 20, 20, 20, 60, 120, 240]);

/**
 * Names this ladder in each score run's record. The "new game finals by polling rung" chart counts only runs that carry the current
 * version, because a rung number means a different time after kickoff under a different ladder. Change it whenever the ladder changes.
 */
export const SCORE_LADDER_VERSION = "2026-11-five-minute";

/**
 * How often the database's score gate wakes the worker, in minutes. It must equal the cron schedule in the migrations
 * (pg_cron job "refresh-final-nfl-scores-every-five-minutes", "*\/5 * * * *"). The worker anchors every retry timer to the tick it was
 * called for, so a retry gap in this ladder is the real gap between two checks. See nextScoreCheckAt.
 */
export const SCORE_GATE_INTERVAL_MINUTES = 5;

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/**
 * The ladder in words, built from the gaps so a text never drifts from the schedule: "seven 5-minute windows, two 10-minute windows,
 * three 20-minute windows, one 60-minute window, one 120-minute window and one 240-minute window".
 * @param {readonly number[]} [minutes]
 */
export function retryLadderSentence(minutes = SCORE_RETRY_MINUTES) {
  const groups = [];
  for (const gap of minutes) {
    if (groups.at(-1)?.gap === gap) groups.at(-1).count += 1;
    else groups.push({ gap, count: 1 });
  }
  const parts = groups.map(({ gap, count }) => `${COUNT_WORDS[count] ?? count} ${gap}-minute window${count === 1 ? "" : "s"}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "no windows";
}
