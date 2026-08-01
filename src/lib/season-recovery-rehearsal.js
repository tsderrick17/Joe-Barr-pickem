import { gradeAtsPick } from "./ats-grading.js";
import { resolvePickemChampions } from "./championship-policy.js";
import { calculatePlayoffEligibility } from "./playoff-math.js";
import { gradeSurvivorPick } from "./survivor-grading.js";

/**
 * A deterministic, in-memory rehearsal of the season's important recovery
 * paths. It exists to prove the rules still agree after refactors without
 * reading or mutating a real player, pick, game, or scoring period.
 */
export function runSeasonRecoveryRehearsal() {
  const atsResult = gradeAtsPick({
    selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 3.5,
    awayTeamId: "away", homeTeamId: "home", awayScore: 27, homeScore: 20,
  });
  const survivorResult = gradeSurvivorPick({
    selectedTeamId: "home", awayTeamId: "away", homeTeamId: "home", awayScore: 17, homeScore: 24,
  });
  const delayedScoreResult = gradeAtsPick({
    selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 3.5,
    awayTeamId: "away", homeTeamId: "home", awayScore: null, homeScore: null,
  });
  const tiedSurvivorResult = gradeSurvivorPick({
    selectedTeamId: "away", awayTeamId: "away", homeTeamId: "home", awayScore: 20, homeScore: 20,
  });
  const playoffEligibility = calculatePlayoffEligibility({
    players: [{ id: "leader" }, { id: "still-alive" }, { id: "out" }],
    periods: [
      { id: "wild-card", display_order: 19, period_type: "playoff", status: "active", max_picks: 2 },
      { id: "division", display_order: 20, period_type: "playoff", status: "upcoming", max_picks: 2 },
    ],
    games: [
      { id: "prior", scoring_period_id: "prior-round", kickoff_at: "2027-01-09T18:00:00.000Z", status: "final" },
      { id: "game-one", scoring_period_id: "wild-card", kickoff_at: "2027-01-10T18:00:00.000Z", status: "scheduled" },
      { id: "game-two", scoring_period_id: "wild-card", kickoff_at: "2027-01-10T21:30:00.000Z", status: "scheduled" },
      { id: "game-three", scoring_period_id: "division", kickoff_at: "2027-01-17T21:30:00.000Z", status: "scheduled" },
    ],
    picks: [
      { player_id: "leader", game_id: "prior", result: "win" },
      { player_id: "leader", game_id: "prior", result: "win" },
      { player_id: "leader", game_id: "prior", result: "win" },
      { player_id: "leader", game_id: "prior", result: "win" },
      { player_id: "leader", game_id: "prior", result: "win" },
      { player_id: "still-alive", game_id: "prior", result: "win" },
    ],
    targetPeriodId: "wild-card",
    now: new Date("2027-01-10T13:00:00.000Z"),
  });
  const champions = resolvePickemChampions([
    { playerId: "al", periodStatus: "complete", result: "win" },
    { playerId: "tyler", periodStatus: "complete", result: "win" },
    { playerId: "al", periodStatus: "complete", result: "loss" },
    { playerId: "tyler", periodStatus: "complete", result: "loss" },
  ]);

  const checks = [
    {
      id: "ats-final",
      label: "Final ATS settlement",
      detail: "A locked spread produces a final win or loss from the recorded score.",
      passed: atsResult === "win",
    },
    {
      id: "survivor-outright",
      label: "Survivor is straight-up only",
      detail: "An outright winner advances; a tie is a loss because no winner was selected.",
      passed: survivorResult === "win" && tiedSurvivorResult === "loss",
    },
    {
      id: "late-score",
      label: "Late score protection",
      detail: "A game without a final score remains pending rather than being guessed or graded early.",
      passed: delayedScoreResult === "pending",
    },
    {
      id: "playoff-snapshot",
      label: "Playoff-day eligibility",
      detail: "Players who can still tie the leader at the Eastern-day snapshot remain eligible; eliminated players do not.",
      passed: !playoffEligibility.eliminatedPlayerIds.has("still-alive") && playoffEligibility.eliminatedPlayerIds.has("out"),
    },
    {
      id: "season-closeout",
      label: "Season closeout",
      detail: "Every completed Pick'em leader is preserved as a co-champion; no arbitrary tiebreaker is manufactured.",
      passed: champions.join(",") === "al,tyler",
    },
  ];

  return {
    status: checks.every((check) => check.passed) ? "healthy" : "attention",
    checks,
  };
}
