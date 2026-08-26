import { easternDateTimeToUtc, getLineLock, getWeekStartKey, getWeekWindow } from "./schedule-time.js";

export const NFLVERSE_SCHEDULE_URL =
  "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

const currentTeamAliases = new Map([
  ["OAK", "LV"], ["SD", "LAC"], ["STL", "LAR"], ["LA", "LAR"],
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

export function parseNflverseGameDates(csv) {
  const rows = parseCsv(csv);
  const headers = rows.shift() ?? [];
  const gamedayColumn = headers.indexOf("gameday");
  if (gamedayColumn < 0) {
    throw new Error("The NFL schedule feed is missing its gameday column.");
  }

  const gameDates = new Set();
  for (const row of rows) {
    const gameday = row[gamedayColumn]?.trim() ?? "";
    if (!gameday) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gameday) || Number.isNaN(Date.parse(`${gameday}T12:00:00Z`))) {
      throw new Error(`The NFL schedule feed contains an invalid gameday: ${gameday}.`);
    }
    gameDates.add(gameday);
  }
  return gameDates;
}

function kickoffFromEastern(gameday, gametime) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gameday);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(gametime);
  if (!dateMatch || !timeMatch) return null;
  return easternDateTimeToUtc(
    Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]),
    Number(timeMatch[1]), Number(timeMatch[2]),
  );
}

export function parseNflverseRegularSeason(csv, seasonYear, { allowWeekGameweekDrift = false } = {}) {
  const rows = parseCsv(csv);
  const headers = rows.shift() ?? [];
  const required = ["game_id", "season", "game_type", "week", "gameday", "gametime", "away_team", "home_team"];
  const column = new Map(headers.map((header, index) => [header, index]));
  const missing = required.filter((header) => !column.has(header));
  if (missing.length) throw new Error(`The full-schedule feed is missing columns: ${missing.join(", ")}.`);

  const value = (row, name) => row[column.get(name)]?.trim() ?? "";
  const games = rows.flatMap((row) => {
    if (Number(value(row, "season")) !== seasonYear || value(row, "game_type") !== "REG") return [];
    const kickoff = kickoffFromEastern(value(row, "gameday"), value(row, "gametime"));
    const week = Number(value(row, "week"));
    if (!kickoff || !Number.isInteger(week) || week < 1 || week > 18) {
      throw new Error(`The full-schedule feed has an invalid date, time, or week for ${value(row, "game_id") || "an unnamed game"}.`);
    }
    const lineLock = getLineLock(kickoff);
    return [{
      providerEventId: value(row, "game_id"),
      week,
      kickoffAt: kickoff.toISOString(),
      awayAbbreviation: currentTeamAliases.get(value(row, "away_team")) ?? value(row, "away_team"),
      homeAbbreviation: currentTeamAliases.get(value(row, "home_team")) ?? value(row, "home_team"),
      lineLockAt: lineLock.lineLockAt,
      isInternational: lineLock.isInternational,
      gameweekKey: getWeekStartKey(kickoff),
    }];
  });

  if (games.length !== 272) {
    throw new Error(`The ${seasonYear} full-schedule feed has ${games.length} regular-season games; expected 272. Import stopped.`);
  }
  if (new Set(games.map((game) => game.providerEventId)).size !== games.length) {
    throw new Error("The full-schedule feed repeats a provider game identifier.");
  }
  for (let week = 1; week <= 18; week += 1) {
    const weekGames = games.filter((game) => game.week === week);
    const keys = new Set(weekGames.map((game) => game.gameweekKey));
    if (weekGames.length < 13 || weekGames.length > 16 || (!allowWeekGameweekDrift && keys.size !== 1)) {
      throw new Error(`Week ${week} is incomplete or spans multiple pool gameweeks. Import stopped.`);
    }
  }
  const appearances = new Map();
  for (const game of games) {
    const pair = `${game.week}:${[game.awayAbbreviation, game.homeAbbreviation].sort().join(":")}`;
    if (appearances.has(pair)) throw new Error(`Week ${game.week} repeats the ${game.awayAbbreviation}/${game.homeAbbreviation} matchup.`);
    appearances.set(pair, true);
  }
  return games.sort((first, second) => first.kickoffAt.localeCompare(second.kickoffAt));
}

export function fullSchedulePeriodAssignments(games, periodsByWeek) {
  return [...periodsByWeek.entries()].map(([week, period]) => {
    const game = games.find((candidate) => candidate.week === week);
    if (!game) throw new Error(`Week ${week} has no game to establish its pool window.`);
    const window = getWeekWindow(game.gameweekKey);
    return { scoring_period_id: period.id, starts_at: window.startsAt, ends_at: window.endsAt };
  });
}
