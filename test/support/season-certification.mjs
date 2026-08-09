const EASTERN_TIME_ZONE = "America/New_York";

export function createSeededRandom(seed = 0x4a6f6542) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function easternDay(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createSeasonClock(initialInstant) {
  let current = new Date(initialInstant);
  if (Number.isNaN(current.getTime())) throw new TypeError("The season clock requires a valid instant.");
  return Object.freeze({
    now: () => new Date(current),
    iso: () => current.toISOString(),
    easternDay: () => easternDay(current),
    set(value) {
      const next = new Date(value);
      if (Number.isNaN(next.getTime())) throw new TypeError("The season clock cannot travel to an invalid instant.");
      current = next;
      return this.now();
    },
    advance(milliseconds) {
      if (!Number.isFinite(milliseconds)) throw new TypeError("Clock movement must be finite.");
      current = new Date(current.getTime() + milliseconds);
      return this.now();
    },
  });
}

// Intentionally independent of the application implementation. This is the
// small mathematical oracle the randomized certification compares it with.
export function playoffEligibilityOracle({ players, periods, games, picks, targetPeriodId, now }) {
  const target = periods.find((period) => period.id === targetPeriodId);
  if (!target || target.period_type !== "playoff" || target.status !== "active") {
    return { applies: false, leaderWinsAtDayStart: 0, remainingPossibleWins: 0, eliminatedPlayerIds: new Set() };
  }

  const today = easternDay(now);
  const gamesById = Object.fromEntries(games.map((game) => [game.id, game]));
  const wins = Object.fromEntries(players.map((player) => [player.id, 0]));
  for (const pick of picks) {
    const game = gamesById[pick.game_id];
    if (pick.result === "win" && game && easternDay(game.kickoff_at) < today) {
      wins[pick.player_id] = (wins[pick.player_id] ?? 0) + 1;
    }
  }

  const leaderWinsAtDayStart = players.reduce((leader, player) => Math.max(leader, wins[player.id] ?? 0), 0);
  let remainingPossibleWins = 0;
  for (const period of periods) {
    if (period.period_type !== "playoff" || period.display_order < target.display_order || period.status === "complete") continue;
    const playable = games.filter((game) => game.scoring_period_id === period.id
      && game.status !== "cancelled" && game.status !== "postponed");
    if (period.id === target.id) {
      remainingPossibleWins += playable.filter((game) => easternDay(game.kickoff_at) >= today).length;
    } else {
      remainingPossibleWins += Math.max(playable.length, period.max_picks);
    }
  }

  return {
    applies: true,
    leaderWinsAtDayStart,
    remainingPossibleWins,
    eliminatedPlayerIds: new Set(players
      .filter((player) => (wins[player.id] ?? 0) + remainingPossibleWins < leaderWinsAtDayStart)
      .map((player) => player.id)),
  };
}

const REPLAY_FIELDS = new Set([
  "type", "externalGameId", "gameweek", "kickoffAt", "lineLockAt",
  "awayTeam", "homeTeam", "status", "awayScore", "homeScore", "recordedAt",
]);
const ALLOWED_EVENT_TYPES = new Set(["scheduled", "rescheduled", "disrupted", "final", "score_corrected"]);

export function sanitizeSeasonReplay(events) {
  if (!Array.isArray(events)) throw new TypeError("Season replay input must be an array.");
  return events.map((event, index) => {
    if (!event || typeof event !== "object" || !ALLOWED_EVENT_TYPES.has(event.type)) {
      throw new TypeError(`Replay event ${index + 1} has an unsupported type.`);
    }
    const clean = {};
    for (const [key, value] of Object.entries(event)) {
      if (REPLAY_FIELDS.has(key) && value !== undefined) clean[key] = value;
    }
    if (!clean.externalGameId || !Number.isInteger(clean.gameweek)) {
      throw new TypeError(`Replay event ${index + 1} needs an external game id and gameweek.`);
    }
    return clean;
  });
}

export function replaySeasonStructure(events) {
  const games = new Map();
  for (const event of sanitizeSeasonReplay(events)) {
    const existing = games.get(event.externalGameId);
    if (event.type === "scheduled") {
      if (existing && existing.gameweek !== event.gameweek) throw new Error("A replay cannot move a game to another gameweek.");
      games.set(event.externalGameId, { ...existing, ...event, originalGameweek: existing?.originalGameweek ?? event.gameweek });
      continue;
    }
    if (!existing) throw new Error(`Replay event ${event.type} arrived before its schedule event.`);
    if (event.gameweek !== existing.originalGameweek) throw new Error("A replay cannot move a game to another gameweek.");
    games.set(event.externalGameId, { ...existing, ...event, originalGameweek: existing.originalGameweek });
  }
  return [...games.values()].sort((left, right) => left.externalGameId.localeCompare(right.externalGameId));
}

