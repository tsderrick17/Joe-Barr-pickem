/**
 * The Trophy Room's numbers: every season's champions, and an all-time table with baseball-style averages.
 *
 * Only graded Pick'em picks count (a win or a loss; a push is a loss, and voided or pending picks never count). Like a batter:
 *   AB   at bats: graded picks            H    hits: covers
 *   AVG  H / AB                           SLG  total bases / AB, where covering as the favorite is a single and covering as an underdog is a double
 *   Best season AVG, over seasons with at least BEST_SEASON_MIN_AB picks
 *   Streak: the longest run of consecutive covers, in the order the games kicked off
 * A player is "qualified" for the batting title at QUALIFYING_AB or more picks, like a batter's plate appearances.
 * The Bowl Pool is a separate game and is not part of the batting table; its champions appear only in the season plaques.
 * Survivor exit: the average regular-season week a player was knocked out of Survivor, over the seasons they were eliminated
 * (a season still alive or won is not an exit, so it is not averaged in).
 */
export const QUALIFYING_AB = 50;
export const BEST_SEASON_MIN_AB = 20;

const isGraded = (pick) => pick.result === "win" || pick.result === "loss";

/** ".571" like a batting average; a perfect 1.000 keeps its zero. */
export function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const text = value.toFixed(3);
  return text.startsWith("0") ? text.slice(1) : text;
}

/**
 * @param {{
 *   players: { id: string, first_name: string }[],
 *   seasons: { id: string, year: number }[],
 *   periods: { id: string, season_id: string, display_order: number, period_type: string }[],
 *   survivorEntries: { player_id: string, eliminated_scoring_period_id: string | null }[],
 *   games: { id: string, kickoff_at: string }[],
 *   lines: { game_id: string, favorite_team_id: string | null }[],
 *   picks: { id: string, player_id: string, game_id: string, scoring_period_id: string, selected_team_id: string, result: string }[],
 *   championships: { season_year: number, pool: string, player_id: string }[],
 *   bowlChampionships: { season_year: number, player_id: string }[],
 * }} input
 */
export function buildAllTimeStats({ players, seasons, periods, games, lines, picks, survivorEntries = [], championships = [], bowlChampionships = [] }) {
  const nameById = new Map(players.map((player) => [player.id, player.first_name]));
  const seasonYearByPeriod = new Map(periods.map((period) => [period.id, seasons.find((season) => season.id === period.season_id)?.year ?? null]));
  const kickoffByGame = new Map(games.map((game) => [game.id, Date.parse(game.kickoff_at)]));
  const favoriteByGame = new Map(lines.map((line) => [line.game_id, line.favorite_team_id]));

  const titlesByPlayer = new Map();
  const addTitle = (playerId, pool) => {
    const titles = titlesByPlayer.get(playerId) ?? { pickem: 0, survivor: 0 };
    titles[pool] += 1;
    titlesByPlayer.set(playerId, titles);
  };

  // Trophy room: one row per season, newest first, with each pool's champion (or null when none was crowned).
  const trophyBySeason = new Map();
  const trophyRow = (year) => {
    const row = trophyBySeason.get(year) ?? { seasonYear: year, pickem: null, survivor: null, bowl: null };
    trophyBySeason.set(year, row);
    return row;
  };
  const champion = (playerId) => ({ playerId, name: nameById.get(playerId) ?? "Former player" });
  for (const record of championships) {
    if (record.pool !== "pickem" && record.pool !== "survivor") continue;
    // A tied Pick'em season has co-champions: keep every name.
    const row = trophyRow(record.season_year);
    row[record.pool] = [...(row[record.pool] ?? []), champion(record.player_id)];
    addTitle(record.player_id, record.pool);
  }
  for (const record of bowlChampionships) {
    const row = trophyRow(record.season_year);
    row.bowl = [...(row.bowl ?? []), champion(record.player_id)];
  }
  const trophies = [...trophyBySeason.values()].sort((a, b) => b.seasonYear - a.seasonYear);

  // Survivor exits: the regular-season week number of each elimination.
  const weekByPeriod = new Map(periods.filter((period) => period.period_type === "regular").map((period) => [period.id, period.display_order]));
  const exitWeeksByPlayer = new Map();
  for (const entry of survivorEntries) {
    const week = entry.eliminated_scoring_period_id ? weekByPeriod.get(entry.eliminated_scoring_period_id) : undefined;
    if (week === undefined) continue;
    exitWeeksByPlayer.set(entry.player_id, [...(exitWeeksByPlayer.get(entry.player_id) ?? []), week]);
  }
  const survivorExit = (playerId) => {
    const weeks = exitWeeksByPlayer.get(playerId) ?? [];
    return weeks.length ? { averageWeek: weeks.reduce((sum, week) => sum + week, 0) / weeks.length, exits: weeks.length } : null;
  };

  // All-time table.
  const picksByPlayer = new Map();
  for (const pick of picks) {
    if (!isGraded(pick)) continue;
    const list = picksByPlayer.get(pick.player_id) ?? [];
    list.push(pick);
    picksByPlayer.set(pick.player_id, list);
  }

  const rows = [];
  for (const [playerId, playerPicks] of picksByPlayer) {
    playerPicks.sort((a, b) => (kickoffByGame.get(a.game_id) ?? 0) - (kickoffByGame.get(b.game_id) ?? 0) || a.id.localeCompare(b.id));
    let hits = 0;
    let bases = 0;
    let streak = 0;
    let longest = 0;
    const bySeason = new Map();
    for (const pick of playerPicks) {
      const year = seasonYearByPeriod.get(pick.scoring_period_id) ?? null;
      const season = bySeason.get(year) ?? { ab: 0, h: 0 };
      bySeason.set(year, season);
      season.ab += 1;
      if (pick.result === "win") {
        hits += 1;
        season.h += 1;
        const favorite = favoriteByGame.get(pick.game_id);
        bases += favorite && favorite !== pick.selected_team_id ? 2 : 1;
        streak += 1;
        longest = Math.max(longest, streak);
      } else {
        streak = 0;
      }
    }
    const ab = playerPicks.length;
    let best = null;
    for (const [year, season] of bySeason) {
      if (year === null || season.ab < BEST_SEASON_MIN_AB) continue;
      const average = season.h / season.ab;
      if (!best || average > best.avg) best = { year, avg: average, ab: season.ab };
    }
    const titles = titlesByPlayer.get(playerId) ?? { pickem: 0, survivor: 0 };
    rows.push({
      playerId,
      name: nameById.get(playerId) ?? "Former player",
      seasons: [...bySeason.keys()].filter((year) => year !== null).length,
      ab,
      h: hits,
      avg: hits / ab,
      slg: bases / ab,
      bestSeason: best,
      longestStreak: longest,
      survivorExit: survivorExit(playerId),
      titles,
      qualified: ab >= QUALIFYING_AB,
    });
  }

  // A champion or a Survivor veteran from a season with no pick history on file (the inaugural year) still belongs in the table, with no at bats.
  for (const playerId of new Set([...titlesByPlayer.keys(), ...exitWeeksByPlayer.keys()])) {
    if (picksByPlayer.has(playerId)) continue;
    rows.push({ playerId, name: nameById.get(playerId) ?? "Former player", seasons: 0, ab: 0, h: 0, avg: null, slg: null, bestSeason: null, longestStreak: 0, survivorExit: survivorExit(playerId), titles: titlesByPlayer.get(playerId) ?? { pickem: 0, survivor: 0 }, qualified: false });
  }

  rows.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (a.qualified) return b.avg - a.avg || b.h - a.h || a.name.localeCompare(b.name);
    return b.ab - a.ab || (b.avg ?? 0) - (a.avg ?? 0) || a.name.localeCompare(b.name);
  });
  return { trophies, players: rows };
}
