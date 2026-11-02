// Both seasons use the same predictable post-kickoff ladder. The 10-minute worker tick makes the first six windows 10 minutes apart in
// wall-clock time; later windows deliberately widen to preserve provider headroom. The score worker and the Commissioner's credit charts
// both read it from here, so a change reaches both.
export const SCORE_RETRY_MINUTES = Object.freeze([10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240]);

/**
 * How often the database's score gate wakes the worker, in minutes. It must equal the cron schedule in the migrations
 * (pg_cron job "refresh-final-nfl-scores-every-ten-minutes", "*\/10 * * * *"). The worker anchors every retry timer to the tick it was
 * called for, so a retry gap in this ladder is the real gap between two checks. See nextScoreCheckAt.
 */
export const SCORE_GATE_INTERVAL_MINUTES = 10;
