// Fictional pool data shaped like the database rows, sized to a real season: players, 18 regular weeks and four
// playoff rounds, picks, games, teams, lines. Nothing here is a real person or pick.
const HOUR = 60 * 60 * 1000;

export const SCENARIOS = {
  early_regular: { label: "Early regular season (week 3)", weeksDone: 2, currentWeek: 3, playoffs: false, priorSeasons: 0 },
  late_regular: { label: "Late regular season (week 16)", weeksDone: 15, currentWeek: 16, playoffs: false, priorSeasons: 0 },
  playoff_round: { label: "Divisional round", weeksDone: 18, currentWeek: 19, playoffs: true, priorSeasons: 0 },
  multi_season: { label: "Late regular season, three prior seasons on file", weeksDone: 15, currentWeek: 16, playoffs: false, priorSeasons: 3 },
};

const PLAYOFF_ROUNDS = [["Wild Card", 6, 6], ["Divisional Round", 4, 4], ["Conference Championships", 2, 2], ["Super Bowl", 1, 1]];

export function buildPool({ seasonYear, now = new Date(), scenario, playerCount = 11, gamesPerWeek = 16 }) {
  const config = SCENARIOS[scenario];
  const players = Array.from({ length: playerCount }, (_, index) => ({ id: `p${index + 1}`, first_name: `Player ${String(index + 1).padStart(2, "0")}`, active: true }));
  const teams = Array.from({ length: 32 }, (_, index) => ({ id: `t${index}`, full_name: `Fictional Team ${index}`, abbreviation: `T${String(index).padStart(2, "0")}` }));

  const seasons = [];
  const periods = [];
  const games = [];
  const picks = [];
  const survivorPicks = [];
  const lines = [];
  const history = [];
  const championships = [];

  const addSeason = (year, current) => {
    const seasonId = `season-${year}`;
    seasons.push({ id: seasonId, year, state: current ? (config.playoffs ? "playoffs" : "regular_season") : "complete", survivor_champion_player_id: null });
    const weekCount = 18;
    const rounds = PLAYOFF_ROUNDS;
    const all = [
      ...Array.from({ length: weekCount }, (_, index) => ({ name: `Week ${index + 1}`, type: "regular", max: 2, order: index + 1 })),
      ...rounds.map(([name, max], index) => ({ name, type: "playoff", max, order: weekCount + index + 1 })),
    ];
    for (const period of all) {
      const done = !current || period.order <= config.weeksDone;
      const active = current && period.order === config.currentWeek;
      const id = `${seasonId}-period-${period.order}`;
      periods.push({ id, season_id: seasonId, display_name: period.name, display_order: period.order, status: done ? "complete" : active ? "active" : "upcoming", period_type: period.type, max_picks: period.max, starts_at: null, ends_at: null });
      if (!done && !active) continue;
      const gameCount = period.type === "regular" ? gamesPerWeek : Math.max(period.max, 1);
      for (let g = 0; g < gameCount; g += 1) {
        const gameId = `${id}-g${g}`;
        const kickoffOffset = done ? -(20 - period.order) * 24 * HOUR : (g < gameCount / 2 ? -2 * HOUR : (g + 1) * 3 * HOUR);
        const started = done || kickoffOffset < 0;
        games.push({
          id: gameId, scoring_period_id: id, away_team_id: teams[(g * 2) % 32].id, home_team_id: teams[(g * 2 + 1) % 32].id,
          kickoff_at: new Date(now.getTime() + kickoffOffset).toISOString(), line_lock_at: new Date(now.getTime() + kickoffOffset - 4 * HOUR).toISOString(),
          is_international: false, status: started ? "final" : "scheduled", away_score: started ? 17 : null, home_score: started ? 24 : null, season_id: seasonId,
        });
        lines.push({ game_id: gameId, favorite_team_id: teams[(g * 2 + 1) % 32].id, locked_spread: 3.5, locked_at: new Date(now.getTime() + kickoffOffset - 4 * HOUR).toISOString(), source: "fixture", source_spread: 3, source_captured_at: now.toISOString() });
        for (let h = 0; h < 3; h += 1) history.push({ game_id: gameId, favorite_team_id: teams[(g * 2 + 1) % 32].id, spread: 3 + h * 0.5, captured_at: new Date(now.getTime() - (h + 1) * 24 * HOUR).toISOString() });
        players.forEach((player, playerIndex) => {
          if ((playerIndex + g) % Math.max(1, Math.floor(gameCount / period.max)) !== 0) return;
          picks.push({ id: `${gameId}-${player.id}`, player_id: player.id, game_id: gameId, selected_team_id: teams[(g * 2 + (playerIndex % 2)) % 32].id, scoring_period_id: id, submitted_at: new Date(now.getTime() - 3 * 24 * HOUR).toISOString(), result: started ? ((playerIndex + g) % 3 === 0 ? "loss" : "win") : "pending" });
        });
      }
    }
  };

  addSeason(seasonYear, true);
  for (let index = 1; index <= config.priorSeasons; index += 1) addSeason(seasonYear - index, false);
  players.forEach((player, index) => {
    if (index < 2) championships.push({ player_id: player.id, pool: "pickem", season_year: seasonYear - 1 });
  });
  const currentPeriod = periods.find((period) => period.season_id === `season-${seasonYear}` && period.display_order === config.currentWeek);
  const eligibility = config.playoffs
    ? players.map((player, index) => ({ scoring_period_id: currentPeriod.id, game_day: "2027-01-17", player_id: player.id, is_eligible: index < players.length - 3, leader_wins_at_day_start: 30, remaining_possible_wins: 4 }))
    : [];
  const entries = players.map((player) => ({ id: `entry-${player.id}`, player_id: player.id, season_id: `season-${seasonYear}`, status: "active", eliminated_scoring_period_id: null }));

  return {
    players,
    tables: {
      seasons, scoring_periods: periods, players, picks, games, teams: teams.map((team) => ({ ...team, name: team.full_name })),
      spread_history: history, game_lines: lines, pool_championships: championships, survivor_entries: entries, survivor_picks: survivorPicks, playoff_day_eligibility: eligibility,
    },
  };
}
