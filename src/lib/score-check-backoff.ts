import { SCORE_RETRY_MINUTES } from "./score-retry-ladder.js";

export type ScorePollingMode = "regular" | "playoff";

// Both seasons use the same post-kickoff ladder (see score-retry-ladder.js). When a game is next checked, and on which tier of that ladder,
// is score-polling-tier.js.
export const SCORE_POLLING_RETRY_MINUTES = SCORE_RETRY_MINUTES;

export function scorePollingMode(isPlayoff: boolean): ScorePollingMode {
  return isPlayoff ? "playoff" : "regular";
}
