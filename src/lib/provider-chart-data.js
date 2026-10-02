import { providerRequestCost } from "./provider-efficiency.js";

const SLATE_GROUP_GAP = 30 * 60000;
const DEFAULT_SCORE_RETRY_MINUTES = [10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240];
function dateKeyInZone(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function reported(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function latestProviderCreditSnapshot(runs, fallbackLimit = 500) {
  let latest = null;
  for (const run of runs) {
    const timestamp = Date.parse(run.completed_at ?? run.started_at);
    if (!Number.isFinite(timestamp)) continue;
    const used = reported(run.details?.requestsUsed);
    const remaining = reported(run.details?.requestsRemaining);
    if (used === null && remaining === null) continue;
    const limit = used !== null && remaining !== null ? used + remaining : fallbackLimit;
    const coherentUsed = used ?? Math.max(0, limit - remaining);
    const coherentRemaining = remaining ?? Math.max(0, limit - coherentUsed);
    if (!latest || timestamp > latest.timestamp) {
      latest = { timestamp, used: coherentUsed, remaining: coherentRemaining, limit };
    }
  }
  return latest ? { ...latest, reportedAt: new Date(latest.timestamp).toISOString() } : null;
}

function scheduleSlates(games) {
  const sorted = [...games].sort((a, b) => Date.parse(a.kickoff_at ?? a.kickoffAt) - Date.parse(b.kickoff_at ?? b.kickoffAt));
  const groups = [];
  for (const game of sorted) {
    const kickoff = Date.parse(game.kickoff_at ?? game.kickoffAt);
    if (!Number.isFinite(kickoff)) continue;
    const group = groups.at(-1);
    if (!group || kickoff - group.firstKickoff > SLATE_GROUP_GAP) groups.push({ firstKickoff: kickoff, games: [game] });
    else group.games.push(game);
  }
  return groups;
}

export function monthlyCreditSeries(runs, now = new Date(), games = [], retryMinutes = DEFAULT_SCORE_RETRY_MINUTES, regularSeasonGameDates = []) {
  const timeZone = "America/New_York";
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const todayIndex = now.getUTCDate() - 1;
  const todayKey = new Date(start + todayIndex * 86400000).toISOString().slice(0, 10);
  const allDays = Array.from({ length: daysInMonth }, (_, index) => ({
    date: new Date(start + index * 86400000).toISOString(), credits: 0, cumulative: 0,
    scores: 0, lines: 0, other: 0, estimatedCalls: 0,
    forecast: 0, forecastCumulative: null, forecastScores: 0, forecastLines: 0, forecastOther: 0, forecastGames: 0, forecastSlates: 0,
  }));
  const daysByKey = new Map(allDays.map((day) => [day.date.slice(0, 10), day]));
  for (const run of runs) {
    const timestamp = Date.parse(run.completed_at ?? run.started_at);
    if (timestamp < start || timestamp > now.getTime() || !Number.isFinite(timestamp)) continue;
    const day = allDays[Math.floor((timestamp - start) / 86400000)];
    const cost = providerRequestCost(run);
    day.credits += cost;
    const isLineRun = run.job_type === "line_locks" || run.job_type === "odds";
    day[run.job_type === "scores" ? "scores" : isLineRun ? "lines" : "other"] += cost;
    if (cost > 0 && reported(run.details?.requestsLast) === null) day.estimatedCalls++;
  }
  let cumulative = 0;
  for (const day of allDays) { cumulative += day.credits; day.cumulative = cumulative; }
  const scoreRuns = runs.filter((run) => run.job_type === "scores" && providerRequestCost(run) > 0);
  const scoreCredits = scoreRuns.reduce((sum, run) => sum + providerRequestCost(run), 0);
  const scoreCostPerCall = scoreRuns.length ? scoreCredits / scoreRuns.length : 2;
  const lineRuns = runs.filter((run) => (run.job_type === "line_locks" || run.job_type === "odds") && providerRequestCost(run) > 0);
  const lineCostPerCall = lineRuns.length ? lineRuns.reduce((sum, run) => sum + providerRequestCost(run), 0) / lineRuns.length : 1;
  const firstHourChecks = Math.min(6, retryMinutes.length);
  const expectedChecks = firstHourChecks * 0.9 + retryMinutes.length * 0.1;
  const monthEnd = start + daysInMonth * 86400000;
  for (const slate of scheduleSlates(games)) {
    const kickoff = slate.firstKickoff;
    if (kickoff >= monthEnd || kickoff <= now.getTime()) continue;
    // Forecasts are grouped by the user's Eastern game day so late Sunday
    // kickoffs do not appear as Monday slates in the chart.
    const day = daysByKey.get(dateKeyInZone(new Date(kickoff), timeZone));
    if (!day) continue;
    day.forecastGames += slate.games.length;
    day.forecastSlates += 1;
    day.forecastScores += expectedChecks * scoreCostPerCall;
    day.forecastLines += lineCostPerCall;
  }
  for (const day of allDays) {
    if (day.date.slice(0, 10) > todayKey) {
      // One daily line check is always expected, even on a no-game day.
      day.forecastLines = 1;
    }
    day.forecast = Math.round(day.forecastScores + day.forecastLines + day.forecastOther);
  }
  let forecastCumulative = cumulative;
  for (const day of allDays) {
    if (day.date.slice(0, 10) < todayKey) continue;
    forecastCumulative += day.forecast;
    day.forecastCumulative = Math.round(forecastCumulative);
  }
  const forecastCredits = Math.round(allDays.reduce((sum, day) => sum + day.forecast, 0));
  const days = allDays.slice(0, todayIndex + 1);
  const regularSundayKeys = [...new Set(regularSeasonGameDates
    .map((value) => dateKeyInZone(new Date(value), timeZone))
    .filter((key) => new Date(`${key}T12:00:00Z`).getUTCDay() === 0 && key <= dateKeyInZone(now, timeZone)))];
  const sundayCredits = new Map(regularSundayKeys.map((key) => [key, 0]));
  for (const run of runs) {
    const timestamp = Date.parse(run.completed_at ?? run.started_at);
    if (!Number.isFinite(timestamp)) continue;
    const key = dateKeyInZone(new Date(timestamp), timeZone);
    if (sundayCredits.has(key)) sundayCredits.set(key, sundayCredits.get(key) + providerRequestCost(run));
  }
  const sundayAverageCredits = regularSundayKeys.length
    ? Math.round((regularSundayKeys.reduce((sum, key) => sum + sundayCredits.get(key), 0) / regularSundayKeys.length) * 10) / 10
    : null;
  const provider = latestProviderCreditSnapshot(runs);
  const untrackedCredits = provider ? Math.max(0, Math.round(provider.used - cumulative)) : null;
  return {
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    forecastCredits, forecastTotal: Math.round(cumulative + forecastCredits),
    forecastFrom: allDays.find((day) => day.forecastCumulative !== null)?.date ?? null,
    forecastAssumptions: `Future score slates use ${Math.round(expectedChecks * 10) / 10} expected provider checks: 90% settle in the first ${firstHourChecks * 10} minutes and 10% follow the full retry ladder. Future line checks use one daily request, including days without games.`,
    days, calendarDays: allDays, trackedCredits: cumulative, reportedUsed: provider?.used ?? null,
    providerLimit: provider?.limit ?? null,
    untrackedCredits,
    remaining: provider?.remaining ?? null,
    sundayAverageCredits,
    regularSundaysElapsed: regularSundayKeys.length,
    reportedAt: provider?.reportedAt ?? null,
  };
}

// Old receipts do not identify games. Only unambiguous live polling windows
// can be attributed; overlapping windows are withheld, never counted twice.
export function slateEfficiencySeries(games, runs, now = new Date()) {
  const groups = [];
  for (const game of [...games].sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))) {
    const kickoff = Date.parse(game.kickoff_at);
    if (!Number.isFinite(kickoff) || kickoff > now.getTime()) continue;
    const group = groups.at(-1);
    if (!group || kickoff - group.firstKickoff > SLATE_GROUP_GAP) groups.push({ firstKickoff: kickoff, games: [game] });
    else group.games.push(game);
  }
  const slates = groups.map(({ firstKickoff, games: slateGames }) => {
    const slateStartedAt = new Date(firstKickoff).toISOString();
    const latestKickoff = Math.max(...slateGames.map((game) => Date.parse(game.kickoff_at)));
    const complete = slateGames.every((game) => game.finalized_at && (game.status == null || game.status === "final") && Number.isFinite(Date.parse(game.finalized_at)));
    const latencyMinutes = complete
      ? Math.round(slateGames.reduce((total, game) => total + Math.max(0, (Date.parse(game.finalized_at) - latestKickoff) / 60000), 0) / slateGames.length)
      : null;
    return {
    slateStartedAt, games: slateGames.length, settledGames: complete ? slateGames.length : 0, latencyMinutes, credits: 0, finals: 0, calls: 0, productive: 0,
    ambiguous: false,
    start: Date.parse(slateStartedAt) + 170 * 60000,
    end: slateGames.every((game) => game.finalized_at)
      ? Math.max(...slateGames.map((game) => Date.parse(game.finalized_at))) + 60000
      : Math.min(now.getTime(), Date.parse(slateStartedAt) + 24 * 60 * 60000),
    };
  });
  for (const run of runs) {
    if (run.job_type !== "scores" || providerRequestCost(run) <= 0) continue;
    const timestamp = Date.parse(run.started_at ?? run.completed_at);
    const candidates = slates.filter((slate) => timestamp >= slate.start && timestamp <= slate.end);
    if (candidates.length !== 1) { for (const slate of candidates) slate.ambiguous = true; continue; }
    const slate = candidates[0];
    const finals = reported(run.details?.newFinals ?? run.details?.finalScoresImported) ?? 0;
    slate.credits += providerRequestCost(run); slate.calls++;
    slate.finals += finals; if (finals > 0) slate.productive++;
  }
  return slates.map((slate) => ({
    slateStartedAt: slate.slateStartedAt, games: slate.games, credits: slate.credits,
    finals: slate.finals, calls: slate.calls, settledGames: slate.settledGames, latencyMinutes: slate.latencyMinutes,
    attribution: slate.ambiguous ? "unavailable" : slate.calls ? "estimated" : "no-data",
    creditsPerGame: !slate.ambiguous && slate.calls > 0 && slate.settledGames > 0 ? slate.credits / slate.settledGames : null,
    creditsPerFinal: !slate.ambiguous && slate.finals > 0 ? slate.credits / slate.finals : null,
    productiveRate: !slate.ambiguous && slate.calls > 0 ? 100 * slate.productive / slate.calls : null,
  }));
}

// Fifteen Eastern calendar dates, including the point's date. Weight by games,
// not by slate, so a single-game Thursday does not count like a Sunday slate.
const easternDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
export function rollingCreditsPerGame15Days(points, index) {
  if (points[index]?.creditsPerGame == null) return null;
  const day = (value) => {
    const parts = easternDayFormatter.formatToParts(new Date(value));
    const valueOf = (type) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(valueOf("year"), valueOf("month") - 1, valueOf("day")) / 86400000;
  };
  const lastDay = day(points[index].slateStartedAt);
  const eligible = points.slice(0, index + 1).filter((point) => {
    const age = lastDay - day(point.slateStartedAt);
    return age >= 0 && age < 15 && point.creditsPerGame !== null && point.creditsPerGame !== undefined && point.settledGames > 0;
  });
  const games = eligible.reduce((sum, point) => sum + point.settledGames, 0);
  return games ? eligible.reduce((sum, point) => sum + point.credits, 0) / games : null;
}
