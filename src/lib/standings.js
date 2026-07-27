/**
 * A standings win is earned only by a settled ATS pick explicitly graded as a
 * win. Pending, loss, and void records must never inflate the scoreboard.
 */
export function countPickemWins(picks) {
  return picks.reduce(
    (wins, pick) => wins + (pick?.result === "win" ? 1 : 0),
    0,
  );
}
