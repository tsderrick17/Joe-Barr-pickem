import { providerRequestCost } from "./provider-efficiency.js";

const DAY = 86400000;
const SLATE_GROUP_GAP = 30 * 60000;
const DEFAULT_SCORE_RETRY_MINUTES = [10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240];
function reported(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
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

export function monthlyCreditSeries(runs, now = new Date(), games = [], retryMinutes = DEFAULT_SCORE_RETRY_MINUTES) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const todayIndex = now.getUTCDate() - 1;
  const allDays = Array.from({ length: daysInMonth }, (_, index) => ({
    date: new Date(start + index * DAY).toISOString(), credits: 0, cumulative: 0,
    scores: 0, lines: 0, other: 0, estimatedCalls: 0,
    forecast: 0, forecastCumulative: null, forecastScores: 0, forecastLines: 0, forecastOther: 0, forecastGames: 0, forecastSlates: 0,
  }));
  let latest = null;
  for (const run of runs) {
    const timestamp = Date.parse(run.completed_at ?? run.started_at);
    if (timestamp < start || timestamp > now.getTime() || !Number.isFinite(timestamp)) continue;
    const day = allDays[Math.floor((timestamp - start) / DAY)];
    const cost = providerRequestCost(run);
    day.credits += cost;
    day[run.job_type === "scores" ? "scores" : run.job_type === "line_locks" ? "lines" : "other"] += cost;
    if (cost > 0 && reported(run.details?.requestsLast) === null) day.estimatedCalls++;
    const used = reported(run.details?.requestsUsed);
    const remaining = reported(run.details?.requestsRemaining);
    if (used !== null && remaining !== null && (!latest || timestamp > latest.timestamp)) latest = { timestamp, used, remaining };
  }
  let cumulative = 0;
  for (const day of allDays) { cumulative += day.credits; day.cumulative = cumulative; }
  const scoreRuns = runs.filter((run) => run.job_type === "scores" && providerRequestCost(run) > 0);
  const scoreCredits = scoreRuns.reduce((sum, run) => sum + providerRequestCost(run), 0);
  const scoreCostPerCall = scoreRuns.length ? scoreCredits / scoreRuns.length : 2;
  const lineRuns = runs.filter((run) => run.job_type === "line_locks" && providerRequestCost(run) > 0);
  const lineCostPerCall = lineRuns.length ? lineRuns.reduce((sum, run) => sum + providerRequestCost(run), 0) / lineRuns.length : 1;
  const otherActual = allDays.reduce((sum, day) => sum + day.other, 0);
  const elapsedDays = Math.max(1, todayIndex + 1);
  // The daily provider health check is a known one-credit baseline. A low
  // observed average must not make quiet future days look nearly free.
  const otherPerDay = Math.max(1, otherActual / elapsedDays);
  const firstHourChecks = Math.min(6, retryMinutes.length);
  const expectedChecks = firstHourChecks * 0.9 + retryMinutes.length * 0.1;
  const monthEnd = start + daysInMonth * DAY;
  for (const slate of scheduleSlates(games)) {
    const kickoff = slate.firstKickoff;
    if (kickoff < start || kickoff >= monthEnd || kickoff <= now.getTime()) continue;
    const dayIndex = Math.floor((kickoff - start) / DAY);
    const day = allDays[dayIndex];
    if (!day) continue;
    day.forecastGames += slate.games.length;
    day.forecastSlates += 1;
    day.forecastScores += expectedChecks * scoreCostPerCall;
    day.forecastLines += lineCostPerCall;
  }
  for (const day of allDays) {
    if (day.date > now.toISOString()) day.forecastOther = otherPerDay;
    day.forecast = Math.round(day.forecastScores + day.forecastLines + day.forecastOther);
  }
  let forecastCumulative = cumulative;
  const todayKey = new Date(start + todayIndex * DAY).toISOString().slice(0, 10);
  for (const day of allDays) {
    if (day.date.slice(0, 10) < todayKey) continue;
    forecastCumulative += day.forecast;
    day.forecastCumulative = Math.round(forecastCumulative);
  }
  const forecastCredits = Math.round(allDays.reduce((sum, day) => sum + day.forecast, 0));
  const days = allDays.slice(0, todayIndex + 1);
  return {
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    forecastCredits, forecastTotal: Math.round(cumulative + forecastCredits),
    forecastFrom: allDays.find((day) => day.forecastCumulative !== null)?.date ?? null,
    forecastAssumptions: `Future score slates use ${Math.round(expectedChecks * 10) / 10} expected provider checks: 90% settle in the first ${firstHourChecks * 10} minutes and 10% follow the full retry ladder. Future line checks use one observed-cost request per 30-minute kickoff slate.`,
    days, calendarDays: allDays, trackedCredits: cumulative, reportedUsed: latest?.used ?? null,
    remaining: latest?.remaining ?? null,
    reportedAt: latest ? new Date(latest.timestamp).toISOString() : null,
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
    return {
    slateStartedAt, games: slateGames.length, credits: 0, finals: 0, calls: 0, productive: 0,
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
    finals: slate.finals, calls: slate.calls,
    attribution: slate.ambiguous ? "unavailable" : slate.calls ? "estimated" : "no-data",
    creditsPerFinal: !slate.ambiguous && slate.finals > 0 ? slate.credits / slate.finals : null,
    productiveRate: !slate.ambiguous && slate.calls > 0 ? 100 * slate.productive / slate.calls : null,
  }));
}
