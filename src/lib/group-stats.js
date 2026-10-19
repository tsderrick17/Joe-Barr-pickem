/**
 * The group's numbers, for the Commissioner's Performance panel: how the whole pool does against the spread. Each player also gets the
 * same full set on their own (the Trophy Room), by the same rules from just their picks.
 *
 * Record and hit rate: every graded Pick'em pick, all seasons, regular season and playoffs (a win or a loss; a push is a loss under the pool
 * rule, shown separately so you can see how often the group lands exactly on the number). Voided and pending picks never count.
 *
 * Weekly records (regular season only): a regular week has two picks, so a player's week is 2-0, 1-1 or 0-2 (a "donut"). A pick not made
 * is a loss, so a week with one pick and one win is 1-1, and a week with none is a donut. A week with a voided pick is left out entirely
 * (it neither counts nor breaks a streak), and only weeks the pool has completed are counted. A player's weeks begin with the first week
 * they made a pick in a season, so nobody is charged for weeks before they joined.
 *
 * Streaks run in order of play across seasons with no reset between them, so a streak still alive at the end of a season carries into the
 * next one. "Longest" is the best run ever; "Now" is the run the player is on at their latest counted week.
 *
 * Splits: of the picks that were graded, how often the group took the favorite or the underdog, and the home or the road team (neutral-site
 * games are their own row), and how each did.
 */

const WEEK_PICKS = 2;
const isDecided = (pick) => pick.result === "win" || pick.result === "loss";

const rate = (wins, total) => (total ? wins / total : null);

/** @param {{ wins: number, losses: number }} record */
const withRate = (record) => ({ ...record, picks: record.wins + record.losses, hitRate: rate(record.wins, record.wins + record.losses) });

/** Longest and current runs of weeks for which `good(week)` holds, over a player's counted weeks in order of play. */
function runs(weeks, good) {
  let current = 0, longest = 0, longestEnd = null;
  for (const week of weeks) {
    if (good(week)) {
      current += 1;
      if (current > longest) { longest = current; longestEnd = week; }
    } else current = 0;
  }
  return { longest, current, longestEnd: longestEnd ? { seasonYear: longestEnd.seasonYear, week: longestEnd.week } : null };
}

/**
 * Record, pushes, seasons and favorite/underdog and home/road splits over a set of picks (the whole pool's, or one player's).
 * Only graded picks count; a push is a loss.
 */
function recordsFor(subset, { periodById, yearBySeason, gameById, lineByGame }) {
  let wins = 0, losses = 0, pushPicks = 0;
  const pushedGames = new Set(), pickedGames = new Set();
  const bucket = () => ({ wins: 0, losses: 0 });
  const side = { favorite: bucket(), underdog: bucket() }, venue = { home: bucket(), away: bucket(), neutral: bucket() };
  const bySeason = new Map();
  for (const pick of subset) {
    if (!isDecided(pick)) continue;
    const period = periodById.get(pick.scoring_period_id), game = gameById.get(pick.game_id), line = lineByGame.get(pick.game_id);
    const year = period ? yearBySeason.get(period.season_id) : undefined;
    const won = pick.result === "win";
    if (won) wins += 1; else losses += 1;
    if (year !== undefined) { const season = bySeason.get(year) ?? bucket(); season[won ? "wins" : "losses"] += 1; bySeason.set(year, season); }
    pickedGames.add(pick.game_id);
    if (game && line && Number.isInteger(game.home_score) && Number.isInteger(game.away_score)) {
      const margin = pick.selected_team_id === game.home_team_id ? game.home_score - game.away_score : game.away_score - game.home_score;
      const adjusted = margin + (pick.selected_team_id === line.favorite_team_id ? -line.locked_spread : line.locked_spread);
      if (!won && adjusted === 0) { pushPicks += 1; pushedGames.add(pick.game_id); }   // landing exactly on the number (or a tied pick'em game) is a push, graded as a loss
    }
    if (line?.favorite_team_id) side[pick.selected_team_id === line.favorite_team_id ? "favorite" : "underdog"][won ? "wins" : "losses"] += 1;
    if (game) venue[game.is_neutral_site ? "neutral" : pick.selected_team_id === game.home_team_id ? "home" : "away"][won ? "wins" : "losses"] += 1;
  }
  const total = wins + losses;
  const share = (bucketRecord, whole) => ({ ...withRate(bucketRecord), share: rate(bucketRecord.wins + bucketRecord.losses, whole) });
  const sideTotal = side.favorite.wins + side.favorite.losses + side.underdog.wins + side.underdog.losses;
  const venueTotal = Object.values(venue).reduce((sum, item) => sum + item.wins + item.losses, 0);
  return {
    record: { ...withRate({ wins, losses }), pushes: pushPicks, pushedGames: pushedGames.size, pushShare: rate(pushedGames.size, pickedGames.size) },
    bySeason: [...bySeason].sort((a, b) => b[0] - a[0]).map(([year, record]) => ({ seasonYear: year, ...withRate(record) })),
    splits: {
      side: { favorite: share(side.favorite, sideTotal), underdog: share(side.underdog, sideTotal) },
      venue: { home: share(venue.home, venueTotal), away: share(venue.away, venueTotal), neutral: share(venue.neutral, venueTotal) },
    },
    graded: total,
  };
}

/**
 * @param {{
 *   players: { id: string, first_name: string }[],
 *   seasons: { id: string, year: number }[],
 *   periods: { id: string, season_id: string, display_order: number, period_type: string, status: string, max_picks: number }[],
 *   games: { id: string, home_team_id: string, away_team_id: string, home_score: number | null, away_score: number | null, is_neutral_site: boolean }[],
 *   lines: { game_id: string, favorite_team_id: string | null, locked_spread: number }[],
 *   picks: { id: string, player_id: string, game_id: string, scoring_period_id: string, selected_team_id: string, result: string }[],
 * }} input
 */
export function buildGroupStats({ players, seasons, periods, games, lines, picks }) {
  const nameById = new Map(players.map((player) => [player.id, player.first_name]));
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const yearBySeason = new Map(seasons.map((season) => [season.id, season.year]));
  const gameById = new Map(games.map((game) => [game.id, game]));
  const lineByGame = new Map(lines.map((line) => [line.game_id, line]));
  const lookups = { periodById, yearBySeason, gameById, lineByGame };

  // --- weekly records: regular-season weeks the pool has completed, two picks each
  const picksByPlayerPeriod = new Map();
  const weeksOfPlayerInSeason = new Map();   // "player|season" -> earliest display_order with a pick
  for (const pick of picks) {
    const period = periodById.get(pick.scoring_period_id);
    if (!period || period.period_type !== "regular") continue;
    const key = `${pick.player_id}|${period.id}`;
    picksByPlayerPeriod.set(key, [...(picksByPlayerPeriod.get(key) ?? []), pick]);
    const joinKey = `${pick.player_id}|${period.season_id}`;
    weeksOfPlayerInSeason.set(joinKey, Math.min(weeksOfPlayerInSeason.get(joinKey) ?? Infinity, period.display_order));
  }
  const counted = periods
    .filter((period) => period.period_type === "regular" && period.status === "complete" && period.max_picks === WEEK_PICKS && yearBySeason.has(period.season_id))
    .sort((a, b) => yearBySeason.get(a.season_id) - yearBySeason.get(b.season_id) || a.display_order - b.display_order);
  const histogram = { donut: 0, split: 0, sweep: 0 };
  const weeksByPlayer = new Map();
  for (const [joinKey, firstWeek] of weeksOfPlayerInSeason) {
    const [playerId, seasonId] = joinKey.split("|");
    for (const period of counted) {
      if (period.season_id !== seasonId || period.display_order < firstWeek) continue;
      const own = picksByPlayerPeriod.get(`${playerId}|${period.id}`) ?? [];
      if (own.some((pick) => pick.result === "void" || pick.result === "pending")) continue;   // a voided or unsettled pick leaves the week out
      const weekWins = own.filter((pick) => pick.result === "win").length;   // a pick not made is a loss, so losses are whatever is left of the two
      const week = { seasonYear: yearBySeason.get(seasonId), week: period.display_order, wins: Math.min(WEEK_PICKS, weekWins) };
      weeksByPlayer.set(playerId, [...(weeksByPlayer.get(playerId) ?? []), week]);
      histogram[week.wins === 0 ? "donut" : week.wins === 1 ? "split" : "sweep"] += 1;
    }
  }
  const weekCount = histogram.donut + histogram.split + histogram.sweep;
  const histogramOf = (weeks) => {
    const counts = { donut: 0, split: 0, sweep: 0 };
    for (const week of weeks) counts[week.wins === 0 ? "donut" : week.wins === 1 ? "split" : "sweep"] += 1;
    return { total: weeks.length, ...counts };
  };

  const streakRows = [...weeksByPlayer].map(([playerId, weeks]) => {
    weeks.sort((a, b) => a.seasonYear - b.seasonYear || a.week - b.week);
    return { playerId, name: nameById.get(playerId) ?? "Former player", weeks: weeks.length, sweeps: runs(weeks, (week) => week.wins === 2), noDonut: runs(weeks, (week) => week.wins > 0) };
  });
  const leaders = (key) => streakRows
    .filter((row) => row[key].longest > 0)
    .map((row) => ({ playerId: row.playerId, name: row.name, longest: row[key].longest, current: row[key].current, endedAt: row[key].longestEnd }))
    .sort((a, b) => b.longest - a.longest || b.current - a.current || a.name.localeCompare(b.name));

  // Each player's own full set: the same record, histogram, streaks and splits from just their picks.
  const picksByPlayer = new Map();
  for (const pick of picks) picksByPlayer.set(pick.player_id, [...(picksByPlayer.get(pick.player_id) ?? []), pick]);
  const streaksByPlayer = new Map(streakRows.map((row) => [row.playerId, row]));
  const summary = (run) => ({ longest: run?.longest ?? 0, current: run?.current ?? 0, endedAt: run?.longestEnd ?? null });
  const eachPlayer = [...new Set([...picksByPlayer.keys(), ...weeksByPlayer.keys()])]
    .map((playerId) => ({
      playerId,
      name: nameById.get(playerId) ?? "Former player",
      ...recordsFor(picksByPlayer.get(playerId) ?? [], lookups),
      weeks: histogramOf(weeksByPlayer.get(playerId) ?? []),
      streaks: { sweeps: summary(streaksByPlayer.get(playerId)?.sweeps), noDonut: summary(streaksByPlayer.get(playerId)?.noDonut) },
    }))
    .filter((player) => player.graded > 0 || player.weeks.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...recordsFor(picks, lookups),
    weeks: { total: weekCount, donut: histogram.donut, split: histogram.split, sweep: histogram.sweep },
    streaks: { sweeps: leaders("sweeps"), noDonut: leaders("noDonut") },
    players: eachPlayer,
  };
}
