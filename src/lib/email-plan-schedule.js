import { easternParts } from "./eastern-time.js";
const EASTERN_ZONE = "America/New_York";

/** @typedef {{ id: string, period_type: string }} ScoringPeriod */
/** @typedef {{ id: string, kickoff_at: string, line_lock_at: string, is_international: boolean, status: string }} ScheduledGame */
/** @typedef {{ automationKey: string, templateId: string, category: string, audience: string, scheduledFor: string, sourceScoringPeriodId: string, sourceGameIds: string[] }} EmailPlanCandidate */
/** @typedef {ReturnType<typeof easternParts>} EasternParts */
/** @typedef {{ parts: EasternParts, games: ScheduledGame[] }} GameDay */

/** @type {Record<string, number>} */
const weekdayIndex = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} [minute]
 * @returns {string}
 */
function easternWallTime(year, month, day, hour, minute = 0) {
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(noonUtc).find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = zoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const direction = match?.[1] === "+" ? 1 : -1;
  const offsetMinutes = direction * (Number(match?.[2] ?? 5) * 60 + Number(match?.[3] ?? 0));
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000).toISOString();
}

/** @param {Pick<EasternParts, "year" | "month" | "day">} parts @param {number} days */
function shiftEasternDate(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** @param {Pick<EasternParts, "year" | "month" | "day">} parts */
function keyDate(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** @param {ScheduledGame} game */
function isPlayable(game) {
  return !["postponed", "cancelled", "no_contest"].includes(game.status);
}

/**
 * @param {ScoringPeriod} period
 * @param {string} templateId
 * @param {string} category
 * @param {string} audience
 * @param {string} scheduledFor
 * @param {string} suffix
 * @param {string[]} [gameIds]
 * @returns {EmailPlanCandidate}
 */
function candidate(period, templateId, category, audience, scheduledFor, suffix, gameIds = []) {
  return {
    automationKey: `plan:${period.id}:${templateId}:${suffix}`,
    templateId,
    category,
    audience,
    scheduledFor,
    sourceScoringPeriodId: period.id,
    sourceGameIds: gameIds,
  };
}

/**
 * Build deterministic automatic-email occurrences for one scoring period.
 * @param {ScoringPeriod} period
 * @param {ScheduledGame[]} rawGames
 * @returns {EmailPlanCandidate[]}
 */
export function buildEmailPlanSchedule(period, rawGames) {
  const games = rawGames.filter(isPlayable).sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
  if (!games.length) return [];
  const result = [];
  /** @type {Map<string, GameDay>} */
  const dayGroups = new Map();
  for (const game of games) {
    const parts = easternParts(game.kickoff_at);
    const date = keyDate(parts);
    const group = dayGroups.get(date) ?? { parts, games: [] };
    group.games.push(game);
    dayGroups.set(date, group);
  }

  const first = easternParts(games[0].kickoff_at);
  const daysBackToWednesday = (weekdayIndex[first.weekday] - weekdayIndex.Wednesday + 7) % 7;
  const wednesday = shiftEasternDate(first, -daysBackToWednesday);
  result.push(candidate(period, "weekly", "weekly", "all_active", easternWallTime(wednesday.year, wednesday.month, wednesday.day, 6, 30), keyDate(wednesday), games.map((game) => game.id)));

  for (const [date, group] of dayGroups) {
    const { parts, games: dayGames } = group;
    // Final-line mail can only go once every playable game that day has its
    // official line, so it is due when the day's last line locks. (Keying it to
    // the first lock made a Sunday with an international game wait overnight
    // from Saturday's 6 PM early lock, which reads as an overdue message.)
    const finalLineReadyAt = dayGames.map((game) => game.line_lock_at).sort().at(-1) ?? easternWallTime(parts.year, parts.month, parts.day, 6, 30);
    result.push(candidate(period, "final_lines", "final_lines", "all_active", finalLineReadyAt, date, dayGames.map((game) => game.id)));
    if (parts.weekday === "Sunday") {
      result.push(candidate(period, "sunday_final_lines", "sunday_final_lines", "all_active", finalLineReadyAt, date, dayGames.map((game) => game.id)));
      result.push(candidate(period, "pick_due_sunday_11", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 11), `${date}:11`));
      result.push(candidate(period, "pick_due_sunday_3", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 15), `${date}:15`));
      result.push(candidate(period, "pick_due_sunday_6", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 18), `${date}:18`));

      /** @type {Array<[string, string, string, number, number]>} */
      const revealWindows = [
        ["early", "sunday_early_reveal", "sunday_early_reveal", 12, 16],
        ["late", "sunday_late_reveal", "sunday_late_reveal", 16, 20],
      ];
      for (const [window, templateId, category, start, end] of revealWindows) {
        const windowGames = dayGames.filter((game) => {
          const hour = easternParts(game.kickoff_at).hour;
          return hour >= start && hour < end;
        });
        if (windowGames.length) {
          const scheduledFor = windowGames.map((game) => game.kickoff_at).sort().at(-1);
          if (scheduledFor) {
            result.push(candidate(period, templateId, category, "all_active", scheduledFor, `${date}:${window}`, windowGames.map((game) => game.id)));
          }
        }
      }
    }
    if (parts.weekday === "Monday") {
      result.push(candidate(period, "pick_due_monday", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 17), `${date}:17`));
    }

    if (period.period_type === "playoff") {
      const lastKickoff = dayGames.map((game) => new Date(game.kickoff_at).getTime()).sort((a, b) => a - b).at(-1);
      if (lastKickoff !== undefined) {
        result.push(candidate(period, "playoff_day_recap", "playoff_day_recap", "all_active", new Date(lastKickoff + 6 * 60 * 60_000).toISOString(), date, dayGames.map((game) => game.id)));
      }
    }
  }

  for (const game of games.filter((item) => item.is_international)) {
    result.push(candidate(period, "early_lock", "early_lock", "all_active", game.line_lock_at, game.id, [game.id]));
  }

  /** @type {Map<string, ScheduledGame[]>} */
  const kickoffGroups = new Map();
  for (const game of games) kickoffGroups.set(game.kickoff_at, [...(kickoffGroups.get(game.kickoff_at) ?? []), game]);
  if (period.period_type === "playoff") {
    for (const [kickoff, windowGames] of kickoffGroups) {
      result.push(candidate(period, "playoff_public_reveal", "playoff_public_reveal", "all_active", kickoff, kickoff, windowGames.map((game) => game.id)));
    }
  } else {
    for (const [kickoff, windowGames] of kickoffGroups) {
      const featured = windowGames.filter((game) => {
        const parts = easternParts(game.kickoff_at);
        return game.is_international || ["Wednesday", "Thursday", "Monday"].includes(parts.weekday) || (parts.weekday === "Sunday" && parts.hour >= 20);
      });
      if (featured.length) result.push(candidate(period, "featured_window_reveal", "featured_window_reveal", "all_active", kickoff, kickoff, featured.map((game) => game.id)));
    }
  }

  return result.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.automationKey.localeCompare(b.automationKey));
}
