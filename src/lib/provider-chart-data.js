import { providerRequestCost } from "./provider-efficiency.js";

const DAY = 86400000;
function reported(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function monthlyCreditSeries(runs, now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const days = Array.from({ length: now.getUTCDate() }, (_, index) => ({
    date: new Date(start + index * DAY).toISOString(), credits: 0, cumulative: 0,
    scores: 0, lines: 0, other: 0, estimatedCalls: 0,
  }));
  let latest = null;
  for (const run of runs) {
    const timestamp = Date.parse(run.completed_at ?? run.started_at);
    if (timestamp < start || timestamp > now.getTime() || !Number.isFinite(timestamp)) continue;
    const day = days[Math.floor((timestamp - start) / DAY)];
    const cost = providerRequestCost(run);
    day.credits += cost;
    day[run.job_type === "scores" ? "scores" : run.job_type === "line_locks" ? "lines" : "other"] += cost;
    if (cost > 0 && reported(run.details?.requestsLast) === null) day.estimatedCalls++;
    const used = reported(run.details?.requestsUsed);
    const remaining = reported(run.details?.requestsRemaining);
    if (used !== null && remaining !== null && (!latest || timestamp > latest.timestamp)) latest = { timestamp, used, remaining };
  }
  let cumulative = 0;
  for (const day of days) { cumulative += day.credits; day.cumulative = cumulative; }
  return {
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    days, trackedCredits: cumulative, reportedUsed: latest?.used ?? null,
    remaining: latest?.remaining ?? null,
    reportedAt: latest ? new Date(latest.timestamp).toISOString() : null,
  };
}

// Old receipts do not identify games. Only unambiguous live polling windows
// can be attributed; overlapping windows are withheld, never counted twice.
export function slateEfficiencySeries(games, runs, now = new Date()) {
  const groups = new Map();
  for (const game of games) {
    const kickoff = Date.parse(game.kickoff_at);
    if (!Number.isFinite(kickoff) || kickoff > now.getTime()) continue;
    const key = new Date(kickoff).toISOString();
    const group = groups.get(key) ?? [];
    group.push(game); groups.set(key, group);
  }
  const slates = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([slateStartedAt, slateGames]) => ({
    slateStartedAt, games: slateGames.length, credits: 0, finals: 0, calls: 0, productive: 0,
    ambiguous: false,
    start: Date.parse(slateStartedAt) + 170 * 60000,
    end: slateGames.every((game) => game.finalized_at)
      ? Math.max(...slateGames.map((game) => Date.parse(game.finalized_at))) + 60000
      : Math.min(now.getTime(), Date.parse(slateStartedAt) + 24 * 60 * 60000),
  }));
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
