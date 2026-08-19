const EASTERN_ZONE = "America/New_York";

const weekdayIndex = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function easternParts(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: part("weekday"),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

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

function shiftEasternDate(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function keyDate(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function isPlayable(game) {
  return !["postponed", "cancelled", "no_contest"].includes(game.status);
}

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

export function buildEmailPlanSchedule(period, rawGames) {
  const games = rawGames.filter(isPlayable).sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
  if (!games.length) return [];
  const result = [];
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
  result.push(candidate(period, "weekly", "weekly", "all_active", easternWallTime(wednesday.year, wednesday.month, wednesday.day, 8), keyDate(wednesday), games.map((game) => game.id)));

  for (const [date, group] of dayGroups) {
    const { parts, games: dayGames } = group;
    result.push(candidate(period, "final_lines", "final_lines", "all_active", easternWallTime(parts.year, parts.month, parts.day, 8, 30), date, dayGames.map((game) => game.id)));
    if (parts.weekday === "Sunday") {
      result.push(candidate(period, "sunday_final_lines", "sunday_final_lines", "all_active", easternWallTime(parts.year, parts.month, parts.day, 8, 30), date, dayGames.map((game) => game.id)));
      result.push(candidate(period, "pick_due_sunday_11", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 11), `${date}:11`));
      result.push(candidate(period, "pick_due_sunday_3", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 15), `${date}:15`));
      result.push(candidate(period, "pick_due_sunday_6", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 18), `${date}:18`));

      for (const [window, templateId, category, start, end] of [
        ["early", "sunday_early_reveal", "sunday_early_reveal", 12, 16],
        ["late", "sunday_late_reveal", "sunday_late_reveal", 16, 20],
      ]) {
        const windowGames = dayGames.filter((game) => {
          const hour = easternParts(game.kickoff_at).hour;
          return hour >= start && hour < end;
        });
        if (windowGames.length) {
          const scheduledFor = windowGames.map((game) => game.kickoff_at).sort().at(-1);
          result.push(candidate(period, templateId, category, "all_active", scheduledFor, `${date}:${window}`, windowGames.map((game) => game.id)));
        }
      }
    }
    if (parts.weekday === "Monday") {
      result.push(candidate(period, "pick_due_monday", "pick_due", "pick_due", easternWallTime(parts.year, parts.month, parts.day, 17), `${date}:17`));
    }

    if (period.period_type === "playoff") {
      const lastKickoff = dayGames.map((game) => new Date(game.kickoff_at).getTime()).sort((a, b) => a - b).at(-1);
      result.push(candidate(period, "playoff_day_recap", "playoff_day_recap", "all_active", new Date(lastKickoff + 6 * 60 * 60_000).toISOString(), date, dayGames.map((game) => game.id)));
    }
  }

  for (const game of games.filter((item) => item.is_international)) {
    result.push(candidate(period, "early_lock", "early_lock", "all_active", game.line_lock_at, game.id, [game.id]));
  }

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
