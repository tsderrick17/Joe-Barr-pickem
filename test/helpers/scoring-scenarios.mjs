// One table of scoring scenarios, run through the application rules (test/scoring-scenarios.test.mjs) and through
// the database functions (test/integration/scoring-scenarios.test.mjs), so the two can never disagree.
//
// favorite: which side the locked line favors ("away", "home"), or null when no line was captured.
// spread: the locked spread (always positive; 0 is a pick'em, where the line designates the home team).
// ats: the side the player picked against the spread; survivor: the side picked straight up.
// atsGrade: "win" | "loss" | "pending". survivorGrade: "win" | "loss".
// dbRefuses: the database is stricter than the grading rule: it will not finalize a game that has ATS picks but no
// official line (the whole call fails and nothing is graded), so the pick stays pending and the game is retried.
//
// Rules under test: a pick wins only if its side beats the number; a push (exactly the spread) is a LOSS for both
// sides; Survivor is straight up and a tie is a LOSS; without a locked line an ATS pick stays pending.
export const SCORING_SCENARIOS = [
  { name: "favorite covers a half-point line", away: 24, home: 17, favorite: "away", spread: 3.5, ats: "away", atsGrade: "win", survivor: "away", survivorGrade: "win" },
  { name: "underdog takes the points and the favorite does not cover", away: 24, home: 17, favorite: "away", spread: 7.5, ats: "home", atsGrade: "win", survivor: "home", survivorGrade: "loss" },
  { name: "favorite does not cover: the favorite pick loses", away: 24, home: 17, favorite: "away", spread: 7.5, ats: "away", atsGrade: "loss", survivor: "away", survivorGrade: "win" },
  { name: "favorite loses outright: the underdog pick wins", away: 10, home: 20, favorite: "away", spread: 3.5, ats: "home", atsGrade: "win", survivor: "home", survivorGrade: "win" },
  { name: "push on a whole-number line: the favorite pick is a loss", away: 24, home: 17, favorite: "away", spread: 7, ats: "away", atsGrade: "loss", survivor: "away", survivorGrade: "win" },
  { name: "push on a whole-number line: the underdog pick is a loss too", away: 24, home: 17, favorite: "away", spread: 7, ats: "home", atsGrade: "loss", survivor: "home", survivorGrade: "loss" },
  { name: "home favorite covers", away: 13, home: 27, favorite: "home", spread: 6.5, ats: "home", atsGrade: "win", survivor: "home", survivorGrade: "win" },
  { name: "home favorite wins but the away dog covers", away: 20, home: 24, favorite: "home", spread: 6.5, ats: "away", atsGrade: "win", survivor: "away", survivorGrade: "loss" },
  { name: "pick'em line: the home team wins", away: 14, home: 17, favorite: "home", spread: 0, ats: "home", atsGrade: "win", survivor: "home", survivorGrade: "win" },
  { name: "pick'em line: the away team picked loses", away: 14, home: 17, favorite: "home", spread: 0, ats: "away", atsGrade: "loss", survivor: "away", survivorGrade: "loss" },
  { name: "pick'em line tied: a tie is a loss for both ATS picks", away: 20, home: 20, favorite: "home", spread: 0, ats: "home", atsGrade: "loss", survivor: "home", survivorGrade: "loss" },
  { name: "tied game: a Survivor tie is a loss, and the favorite does not cover", away: 20, home: 20, favorite: "away", spread: 3.5, ats: "away", atsGrade: "loss", survivor: "away", survivorGrade: "loss" },
  { name: "tied game: the underdog covers", away: 20, home: 20, favorite: "away", spread: 3.5, ats: "home", atsGrade: "win", survivor: "home", survivorGrade: "loss" },
  { name: "no locked line yet: an ATS pick stays pending, Survivor is still graded", away: 31, home: 10, favorite: null, spread: null, ats: "away", atsGrade: "pending", survivor: "away", survivorGrade: "win", dbRefuses: true },
  { name: "blowout: a large favorite covers a large spread", away: 45, home: 3, favorite: "away", spread: 20.5, ats: "away", atsGrade: "win", survivor: "away", survivorGrade: "win" },
  { name: "shutout: the underdog cannot cover a large spread", away: 0, home: 38, favorite: "home", spread: 14.5, ats: "away", atsGrade: "loss", survivor: "away", survivorGrade: "loss" },
];
