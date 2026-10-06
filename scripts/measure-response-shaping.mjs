#!/usr/bin/env node

// Fictional, deterministic CPU/JSON-size baseline for the two player-facing
// response shapers. This intentionally does not claim to measure database I/O
// or production route latency; see docs/RESPONSE_COST_BASELINE.md.
import "../test/helpers/typescript-renderer.mjs";
import { performance } from "node:perf_hooks";

const { shapePadRows } = await import("../src/lib/home-shape.ts");
const { shapeSlateGames } = await import("../src/lib/slate-shape.ts");

const NOW = new Date("2026-10-04T17:30:00Z");
const players = Array.from({ length: 11 }, (_, index) => ({ id: `player-${index + 1}`, first_name: `Player ${String(index + 1).padStart(2, "0")}` }));
const scenarios = [
  { name: "early_regular", completedWeeks: 2, games: 16, picksPerPlayer: 2, startedGames: 0 },
  { name: "late_regular", completedWeeks: 16, games: 16, picksPerPlayer: 2, startedGames: 8 },
  { name: "playoff_round", completedWeeks: 18, games: 6, picksPerPlayer: 6, startedGames: 3 },
];

function fixture({ completedWeeks, games: gameCount, picksPerPlayer, startedGames }) {
  const teams = Array.from({ length: gameCount * 2 }, (_, index) => ({
    id: `team-${index}`, full_name: `Fictional Team ${index}`, abbreviation: `T${index}`,
  }));
  const games = Array.from({ length: gameCount }, (_, index) => ({
    id: `current-game-${index}`,
    away_team_id: teams[index * 2].id,
    home_team_id: teams[index * 2 + 1].id,
    kickoff_at: index < startedGames ? "2026-10-04T17:00:00Z" : "2026-10-04T20:25:00Z",
    line_lock_at: "2026-10-04T16:00:00Z",
    is_international: false,
    status: index < startedGames ? "final" : "scheduled",
    away_score: index < startedGames ? 21 : null,
    home_score: index < startedGames ? 24 : null,
  }));
  const currentWeekPicks = players.flatMap((player, playerIndex) =>
    Array.from({ length: picksPerPlayer }, (_, pickIndex) => {
      const game = games[(playerIndex + pickIndex) % games.length];
      return {
        player_id: player.id, game_id: game.id, selected_team_id: game.home_team_id,
        scoring_period_id: "current", submitted_at: "2026-10-01T00:00:00Z",
        result: game.status === "final" ? (pickIndex % 2 ? "loss" : "win") : "pending",
      };
    }));
  const historicalPicks = Array.from({ length: completedWeeks }, (_, weekIndex) =>
    players.flatMap((player, playerIndex) => Array.from({ length: 2 }, (_, pickIndex) => ({
      player_id: player.id, game_id: `prior-${weekIndex}-${pickIndex}`,
      selected_team_id: teams[(playerIndex + pickIndex) % teams.length].id,
      scoring_period_id: `prior-${weekIndex}`, submitted_at: "2026-09-01T00:00:00Z",
      result: (weekIndex + playerIndex + pickIndex) % 3 === 0 ? "loss" : "win",
    })))).flat();
  const lockedLines = games.slice(0, startedGames).map((game) => ({
    game_id: game.id, favorite_team_id: game.home_team_id, locked_spread: 2.5,
    source: "fixture", locked_at: "2026-10-04T16:00:00Z",
  }));
  const history = games.map((game) => ({
    game_id: game.id, favorite_team_id: game.home_team_id, spread: 2.5,
    captured_at: "2026-10-03T00:00:00Z",
  }));
  const gameById = new Map(games.map((game) => [game.id, { id: game.id, kickoff_at: game.kickoff_at }]));
  const teamById = new Map(teams.map((team) => [team.id, { name: team.full_name, abbreviation: team.abbreviation }]));
  const lockedLineByGameId = new Map(lockedLines.map((line) => [line.game_id, line]));
  const preliminaryLineByGameId = new Map(history.map((line) => [line.game_id, line]));
  const publicPicks = currentWeekPicks
    .filter((pick) => new Date(gameById.get(pick.game_id).kickoff_at) <= NOW)
    .map((pick) => ({ player_id: pick.player_id, game_id: pick.game_id, selected_team_id: pick.selected_team_id }));
  return {
    homeInput: {
      players, allPicks: [...historicalPicks, ...currentWeekPicks], currentWeekPicks,
      gameById, teamById, lockedLineByGameId, preliminaryLineByGameId,
      trophiesByPlayerId: new Map(), playoffEliminatedPlayerIds: new Set(),
      viewerPlayerId: players[0].id, now: NOW,
    },
    slateInput: { games, teams, history, lockedLines, publicPicks, players, now: NOW },
    inputRows: {
      players: players.length, games: games.length, seasonPicks: historicalPicks.length + currentWeekPicks.length,
      currentPicks: currentWeekPicks.length, publicPicks: publicPicks.length,
      preliminaryLines: history.length, officialLines: lockedLines.length,
    },
  };
}

function measure(run) {
  for (let index = 0; index < 10; index++) run();
  const samples = [];
  for (let sample = 0; sample < 9; sample++) {
    const start = performance.now();
    for (let index = 0; index < 100; index++) run();
    samples.push((performance.now() - start) / 100);
  }
  samples.sort((left, right) => left - right);
  const shaped = run();
  return {
    medianMs: Number(samples[4].toFixed(3)),
    shapedBytes: Buffer.byteLength(JSON.stringify(shaped)),
    outputRows: shaped.length,
  };
}

const results = scenarios.map((scenario) => {
  const { homeInput, slateInput, inputRows } = fixture(scenario);
  return {
    scenario: scenario.name,
    inputRows,
    standingsShape: measure(() => shapePadRows(homeInput)),
    slateShape: measure(() => shapeSlateGames(slateInput)),
  };
});

const output = { kind: "fictional-response-shaping-only", node: process.version, samples: 9, callsPerSample: 100, results };
console.log(JSON.stringify(output, null, process.argv.includes("--json") ? 0 : 2));
