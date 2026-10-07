// Expected results are specified independently from gradeAtsPick and mirror
// the pool's established rule: ATS pushes are losses; incomplete inputs remain
// pending. Keep these fixtures free of database IDs and real pool data so the
// isolated database contract test can reuse them verbatim.
export const atsGradingScenarios = [
  {
    name: "half-point favorite covers",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 3.5, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 20 },
    expected: "win",
  },
  {
    name: "half-point underdog covers",
    pick: { selectedTeamId: "home", favoriteTeamId: "away", lockedSpread: 3.5, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 22 },
    expected: "win",
  },
  {
    name: "whole-point home favorite fails to cover",
    pick: { selectedTeamId: "home", favoriteTeamId: "home", lockedSpread: 7, awayTeamId: "away", homeTeamId: "home", awayScore: 17, homeScore: 20 },
    expected: "loss",
  },
  {
    name: "whole-point underdog does not cover",
    pick: { selectedTeamId: "home", favoriteTeamId: "away", lockedSpread: 3, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 20 },
    expected: "loss",
  },
  {
    name: "favorite pushes on a whole-point spread",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 3, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 21 },
    expected: "loss",
  },
  {
    name: "underdog pushes on a whole-point spread",
    pick: { selectedTeamId: "home", favoriteTeamId: "away", lockedSpread: 3, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 21 },
    expected: "loss",
  },
  {
    name: "pick'em winner wins straight up",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 0, awayTeamId: "away", homeTeamId: "home", awayScore: 20, homeScore: 17 },
    expected: "win",
  },
  {
    name: "pick'em tie is a loss",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 0, awayTeamId: "away", homeTeamId: "home", awayScore: 20, homeScore: 20 },
    expected: "loss",
  },
  {
    name: "missing official favorite remains pending",
    pick: { selectedTeamId: "away", favoriteTeamId: null, lockedSpread: 3.5, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 20 },
    expected: "pending",
  },
  {
    name: "missing official spread remains pending",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: null, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 20 },
    expected: "pending",
  },
  {
    name: "non-finite official spread remains pending",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: Number.NaN, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 20 },
    expected: "pending",
  },
  {
    name: "team outside the game remains pending",
    pick: { selectedTeamId: "other", favoriteTeamId: "away", lockedSpread: 3.5, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 20 },
    expected: "pending",
  },
  {
    name: "unfinished score remains pending",
    pick: { selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 3.5, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: null },
    expected: "pending",
  },
];
