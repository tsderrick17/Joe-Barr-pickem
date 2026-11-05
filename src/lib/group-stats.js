/**
 * The group's numbers, for the Commissioner's Performance panel: how the whole pool does against the spread. Each player also gets the
 * same full set on their own (the Trophy Room), by the same rules from just their picks.
 *
 * Record and hit rate: every graded Pick'em pick, all seasons, regular season and playoffs (a win or a loss; a push is a loss under the pool
 * rule, shown separately so you can see how often the group lands exactly on the number). Voided and pending picks never count.
 *
 * Weekly records (regular season only): a regular week has two picks, so a player's week is 2-0, 1-1 or 0-2 (a "donut"). A pick not made
 * is a loss, so a week with one pick and one win is 1-1, and a week with none is a donut. A week with a voided pick is left out entirely
 * (it neither counts nor breaks a streak). A week the pool has completed (or whose every game is final) counts for everyone; a week still
 * being played counts for a player the moment both of their picks are graded, because nothing left in the week can change their 2-0, 1-1 or
 * 0-2. A player's weeks begin with the first week they made a pick in a season, so nobody is charged for weeks before they joined.
 *
 * Streaks run in order of play across seasons with no reset between them, so a streak still alive at the end of a season carries into the
 * next one. "Longest" is the best run ever; "Now" is the run the player is on at their latest counted week.
 *
 * Most picked team: of the graded picks, which teams were taken most often (top five, with how often and how they did). The five teams with the
 * best hit rate come with them (ties go to the team picked more often), and so do the five least picked (ties alphabetical) and the five with the
 * lowest hit rate (ties to the team picked more often), so the Performance panel can sort either way, highest or lowest.
 *
 * Splits: of the picks that were graded, how often the group took the favorite, the underdog or a pick'em game (a locked spread of 0: the line names the home team as its "favorite" only by the pool's PK convention, so a pick'em game is never counted as a favorite or an underdog), and the home or the road team (the Super Bowl has a designated home team, and international games are not treated as neutral), and how each did.
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
function recordsFor(subset, { periodById, yearBySeason, gameById, lineByGame, teamById }) {
  let wins = 0, losses = 0, pushPicks = 0;
  const pushedGames = new Set(), pickedGames = new Set();
  const bucket = () => ({ wins: 0, losses: 0 });
  const side = { favorite: bucket(), underdog: bucket(), pickem: bucket() }, venue = { home: bucket(), away: bucket() };
  const bySeason = new Map(), byTeam = new Map();
  for (const pick of subset) {
    if (!isDecided(pick)) continue;
    const period = periodById.get(pick.scoring_period_id), game = gameById.get(pick.game_id), line = lineByGame.get(pick.game_id);
    const year = period ? yearBySeason.get(period.season_id) : undefined;
    const won = pick.result === "win";
    if (won) wins += 1; else losses += 1;
    if (year !== undefined) { const season = bySeason.get(year) ?? bucket(); season[won ? "wins" : "losses"] += 1; bySeason.set(year, season); }
    pickedGames.add(pick.game_id);
    { const team = byTeam.get(pick.selected_team_id) ?? bucket(); team[won ? "wins" : "losses"] += 1; byTeam.set(pick.selected_team_id, team); }
    if (game && line && Number.isInteger(game.home_score) && Number.isInteger(game.away_score)) {
      const margin = pick.selected_team_id === game.home_team_id ? game.home_score - game.away_score : game.away_score - game.home_score;
      const adjusted = margin + (pick.selected_team_id === line.favorite_team_id ? -line.locked_spread : line.locked_spread);
      if (!won && adjusted === 0) { pushPicks += 1; pushedGames.add(pick.game_id); }   // landing exactly on the number (or a tied pick'em game) is a push, graded as a loss
    }
    const kind = line && line.locked_spread != null && Number(line.locked_spread) === 0 ? "pickem" : line?.favorite_team_id ? (pick.selected_team_id === line.favorite_team_id ? "favorite" : "underdog") : null;
    if (kind) side[kind][won ? "wins" : "losses"] += 1;
    if (game) venue[pick.selected_team_id === game.home_team_id ? "home" : "away"][won ? "wins" : "losses"] += 1;
  }
  const total = wins + losses;
  const share = (bucketRecord, whole) => ({ ...withRate(bucketRecord), share: rate(bucketRecord.wins + bucketRecord.losses, whole) });
  const sideTotal = Object.values(side).reduce((sum, item) => sum + item.wins + item.losses, 0);
  const venueTotal = Object.values(venue).reduce((sum, item) => sum + item.wins + item.losses, 0);
  const everyTeam = [...byTeam]
    .map(([teamId, record]) => ({ teamId, name: teamById.get(teamId)?.full_name ?? "Unknown team", abbreviation: teamById.get(teamId)?.abbreviation ?? "", ...withRate(record), share: rate(record.wins + record.losses, total) }))
    .sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));
  const teams = everyTeam.slice(0, 5);
  const teamsByHitRate = [...everyTeam].sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0) || b.picks - a.picks || a.name.localeCompare(b.name)).slice(0, 5);
  const teamsLeastPicked = [...everyTeam].sort((a, b) => a.picks - b.picks || a.name.localeCompare(b.name)).slice(0, 5);
  const teamsByLowestHitRate = [...everyTeam].sort((a, b) => (a.hitRate ?? 0) - (b.hitRate ?? 0) || b.picks - a.picks || a.name.localeCompare(b.name)).slice(0, 5);
  const tiedForMost = everyTeam.length ? everyTeam.filter((team) => team.picks === everyTeam[0].picks).length : 0;   // how many teams share the top spot
  return {
    record: { ...withRate({ wins, losses }), pushes: pushPicks, pushedGames: pushedGames.size, pushShare: rate(pushedGames.size, pickedGames.size) },
    teams,
    teamsByHitRate,
    teamsLeastPicked,
    teamsByLowestHitRate,
    mostPicked: teams[0] ?? null,
    mostPickedTied: tiedForMost,   // 1 when one team leads; more when teams tie for the most picks
    bySeason: [...bySeason].sort((a, b) => b[0] - a[0]).map(([year, record]) => ({ seasonYear: year, ...withRate(record) })),
    splits: {
      side: { favorite: share(side.favorite, sideTotal), underdog: share(side.underdog, sideTotal), pickem: share(side.pickem, sideTotal) },
      venue: { home: share(venue.home, venueTotal), away: share(venue.away, venueTotal) },
    },
    graded: total,
  };
}

/**
 * Regular-season weeks, two picks each, per player: { seasonYear, week, wins }. A finished week (complete, or every game final) counts for every
 * player; a week still being played counts only for a player whose two picks are both graded, since their week is already decided. A week with a
 * voided or unsettled pick is left out; a pick not made is a loss once the week is finished; a player's weeks begin with the first week they
 * made a pick in a season.
 */
function playerWeeks({ periodById, yearBySeason, periods, picks, settledPeriodIds = new Set() }) {
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
  const finished = (period) => period.status === "complete" || settledPeriodIds.has(period.id);
  const counted = periods
    .filter((period) => period.period_type === "regular" && period.max_picks === WEEK_PICKS && yearBySeason.has(period.season_id))
    .sort((a, b) => yearBySeason.get(a.season_id) - yearBySeason.get(b.season_id) || a.display_order - b.display_order);
  const histogram = { donut: 0, split: 0, sweep: 0 };
  const weeksByPlayer = new Map();
  for (const [joinKey, firstWeek] of weeksOfPlayerInSeason) {
    const [playerId, seasonId] = joinKey.split("|");
    for (const period of counted) {
      if (period.season_id !== seasonId || period.display_order < firstWeek) continue;
      const own = picksByPlayerPeriod.get(`${playerId}|${period.id}`) ?? [];
      if (own.some((pick) => pick.result === "void" || pick.result === "pending")) continue;   // a voided or unsettled pick leaves the week out
      if (!finished(period) && own.filter(isDecided).length < WEEK_PICKS) continue;   // a week still in play counts once this player's own two picks are graded
      const weekWins = own.filter((pick) => pick.result === "win").length;   // a pick not made is a loss, so losses are whatever is left of the two
      const week = { seasonYear: yearBySeason.get(seasonId), week: period.display_order, wins: Math.min(WEEK_PICKS, weekWins) };
      weeksByPlayer.set(playerId, [...(weeksByPlayer.get(playerId) ?? []), week]);
      histogram[week.wins === 0 ? "donut" : week.wins === 1 ? "split" : "sweep"] += 1;
    }
  }
  return { weeksByPlayer, histogram };
}

const NOT_PLAYED = ["postponed", "cancelled", "no_contest"];

/** A playoff round that counts toward Perfect Weeks: every one but the Super Bowl (a single game, not a week). */
const isScoredRound = (period) => period.period_type === "playoff" && period.display_name !== "Super Bowl";

/**
 * Perfect playoff rounds per player: a round in which the player won every pick the round allowed, with no loss. The round allows
 * `max_picks` picks, or fewer when it has fewer games to play (a postponed, cancelled or no-contest game is not one). The player's own
 * round is decided the moment those wins are in, since nothing else can change it, so it does not wait for the round to finish.
 * @returns {Map<string, number>} playerId -> perfect rounds
 */
function perfectRounds({ periods, yearBySeason, picks, games }) {
  const rounds = new Map(periods.filter((period) => isScoredRound(period) && yearBySeason.has(period.season_id)).map((period) => [period.id, period]));
  const playable = new Map();
  for (const game of games) {
    if (NOT_PLAYED.includes(game.status)) continue;
    playable.set(game.scoring_period_id, (playable.get(game.scoring_period_id) ?? 0) + 1);
  }
  const tallies = new Map();
  for (const pick of picks) {
    if (!rounds.has(pick.scoring_period_id)) continue;
    const key = `${pick.player_id}|${pick.scoring_period_id}`;
    const tally = tallies.get(key) ?? { playerId: pick.player_id, periodId: pick.scoring_period_id, wins: 0, losses: 0 };
    if (pick.result === "win") tally.wins += 1;
    else if (pick.result === "loss") tally.losses += 1;
    tallies.set(key, tally);
  }
  const perfect = new Map();
  for (const { playerId, periodId, wins, losses } of tallies.values()) {
    const needed = Math.max(1, Math.min(rounds.get(periodId).max_picks, playable.get(periodId) ?? Infinity));
    if (losses === 0 && wins >= needed) perfect.set(playerId, (perfect.get(playerId) ?? 0) + 1);
  }
  return perfect;
}

/**
 * Each player's two streaks (regular season, carried across seasons): weeks in a row with at least 1 win, and 2-0 weeks in a row, as
 * { longest, current, endedAt }. The 2-0 streak also carries `total`, how many perfect weeks the player has had in all: the regular season's
 * 2-0 weeks plus every playoff round won pick for pick, everything but the Super Bowl. Only the streaks are regular season. Only the periods and picks are needed.
 * A week counts once it is complete OR every game in it is final (`settledPeriodIds`), so a streak does not wait for the pool to advance.
 * `games` (id of the period and status) tell a round how many picks it really allowed; `display_name` on the periods names the Super Bowl.
 * @param {{ seasons: { id: string, year: number }[], periods: object[], picks: object[], settledPeriodIds?: Set<string>, games?: { scoring_period_id: string, status: string }[] }} input
 * @returns {Map<string, { sweeps: { longest: number, current: number, endedAt: object | null, total: number }, noDonut: { longest: number, current: number, endedAt: object | null } }>}
 */
export function weeklyStreaks({ seasons, periods, picks, settledPeriodIds = new Set(), games = [] }) {
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const yearBySeason = new Map(seasons.map((season) => [season.id, season.year]));
  const { weeksByPlayer } = playerWeeks({ periodById, yearBySeason, periods, picks, settledPeriodIds });
  const summary = (run) => ({ longest: run.longest, current: run.current, endedAt: run.longestEnd });
  const playoffPerfect = perfectRounds({ periods, yearBySeason, picks, games });
  return new Map([...new Set([...weeksByPlayer.keys(), ...playoffPerfect.keys()])].map((playerId) => {
    const weeks = weeksByPlayer.get(playerId) ?? [];
    weeks.sort((a, b) => a.seasonYear - b.seasonYear || a.week - b.week);
    return [playerId, { sweeps: { ...summary(runs(weeks, (week) => week.wins === 2)), total: weeks.filter((week) => week.wins === 2).length + (playoffPerfect.get(playerId) ?? 0) }, noDonut: summary(runs(weeks, (week) => week.wins > 0)) }];
  }));
}

/**
 * @param {{
 *   players: { id: string, first_name: string }[],
 *   seasons: { id: string, year: number }[],
 *   periods: { id: string, season_id: string, display_order: number, period_type: string, status: string, max_picks: number }[],
 *   games: { id: string, home_team_id: string, away_team_id: string, home_score: number | null, away_score: number | null }[],
 *   lines: { game_id: string, favorite_team_id: string | null, locked_spread: number }[],
 *   picks: { id: string, player_id: string, game_id: string, scoring_period_id: string, selected_team_id: string, result: string }[],
 *   teams?: { id: string, full_name: string, abbreviation: string }[],
 * }} input
 */
export function buildGroupStats({ players, seasons, periods, games, lines, picks, teams = [] }) {
  const nameById = new Map(players.map((player) => [player.id, player.first_name]));
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const yearBySeason = new Map(seasons.map((season) => [season.id, season.year]));
  const gameById = new Map(games.map((game) => [game.id, game]));
  const lineByGame = new Map(lines.map((line) => [line.game_id, line]));
  const lookups = { periodById, yearBySeason, gameById, lineByGame, teamById: new Map(teams.map((team) => [team.id, team])) };

  const { weeksByPlayer, histogram } = playerWeeks({ periodById, yearBySeason, periods, picks });
  const weekCount = histogram.donut + histogram.split + histogram.sweep;
  const histogramOf = (weeks) => {
    const counts = { donut: 0, split: 0, sweep: 0 };
    for (const week of weeks) counts[week.wins === 0 ? "donut" : week.wins === 1 ? "split" : "sweep"] += 1;
    return { total: weeks.length, ...counts };
  };

  // Each player's own full set: the same record, histogram and splits from just their picks.
  const picksByPlayer = new Map();
  for (const pick of picks) picksByPlayer.set(pick.player_id, [...(picksByPlayer.get(pick.player_id) ?? []), pick]);
  const eachPlayer = [...new Set([...picksByPlayer.keys(), ...weeksByPlayer.keys()])]
    .map((playerId) => ({
      playerId,
      name: nameById.get(playerId) ?? "Former player",
      ...recordsFor(picksByPlayer.get(playerId) ?? [], lookups),
      weeks: histogramOf(weeksByPlayer.get(playerId) ?? []),
    }))
    .filter((player) => player.graded > 0 || player.weeks.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...recordsFor(picks, lookups),
    weeks: { total: weekCount, donut: histogram.donut, split: histogram.split, sweep: histogram.sweep },
    players: eachPlayer,
  };
}

/**
 * The scoring periods whose games are all final (games that were postponed, cancelled or ruled no contest do not hold a week open). A period
 * with no playable game is not settled.
 * @param {{ scoring_period_id: string, status: string }[]} games
 * @returns {Set<string>}
 */
export function settledPeriods(games) {
  const open = new Set(), seen = new Set();
  for (const game of games) {
    if (["postponed", "cancelled", "no_contest"].includes(game.status)) continue;
    seen.add(game.scoring_period_id);
    if (game.status !== "final") open.add(game.scoring_period_id);
  }
  return new Set([...seen].filter((id) => !open.has(id)));
}
