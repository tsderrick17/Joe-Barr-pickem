"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EfficiencyTrendPanel, { type CreditUsage, type EfficiencyPoint } from "@/components/efficiency-trend-panel";
import { FIRST_SCORE_CHECK_DELAY_MINUTES } from "@/lib/score-window.js";
import { LadderHistogram } from "@/components/polling-strategy-panel";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAdminNumber } from "@/lib/format-admin-number.js";

type Dashboard = {
  checkedAt: string;
  creditUsage: CreditUsage;
  ladderCoverage?: { since: string | null; runs: number };
  ladderSummary: Array<{ rung: number; windowMinutes: number; newFinals: number; pickedUp: number; percentage: number; newFinalsPercentage: number }>;
  status: "healthy" | "attention";
  periods: Array<{ id: string; displayName: string; status: string; type: string }>;
  period: { id: string; displayName: string; type: string; status: string } | null;
  metrics: { games: number; live: number; settled: number; awaitingGrade: number; gradeEligibleGames: number; gradeCompleteGames: number; pendingGradeGames: number; attention: number; activePlayers: number; lastScoreSyncAt: string | null; lastScoreSyncAgeMinutes: number | null; latestScoreSyncStatus: string; providerAllowance: number | null; pickOutcomes: { win: number; loss: number; void: number; pending: number }; survivorEntries: { active: number; eliminated: number; complete: number }; reminders: { scheduled: number; sending: number; sent: number; cancelled: number; test: number }; efficiency: { totalCredits: number; scoreCredits: number; spreadCredits: number; finalizedGames: number; creditsPerFinal: number | null; productiveRate: number | null; trend: string; history: EfficiencyPoint[] }; settlementLatency: { averageMinutes: number | null; slowestMinutes: number | null; samples: number; history: Array<{ label: string; shortLabel: string; minutes: number }> }; comparison: { previousPeriod: string | null; previousAverageMinutes: number | null; deltaMinutes: number | null; history: Array<{ id: string; label: string; shortLabel: string; averageMinutes: number | null; samples: number }> }; readiness: { scheduleLoaded: boolean; linesLocked: number; lineTotal: number; nextKickoffAt: string | null; nextLineLockAt: string | null } } | null;
  games: Array<{ id: string; away: string; home: string; awayName: string; homeName: string; kickoffAt: string; finalizedAt: string | null; gradedWindow?: { rung: number; windowMinutes: number } | null; status: string; state: string; score: string | null; needsAttention: boolean; picks: { total: number; pending: number; graded: number; visible: boolean }; survivor: { total: number; pending: number } }>;
  attention: Array<{ id: string; severity: string; title: string; detail: string }>;
  audit: Array<{ id: string; action: string; entityType: string; details: Record<string, unknown>; createdAt: string }>;
  workerRuns: Array<{ jobType: string; status: string; startedAt: string; completedAt: string | null; error: string | null }>;
  cadence: { firstCheckMinutesAfterKickoff: number; cronIntervalMinutes: number; regularRetryMinutes: number[]; playoffRetryMinutes: number[]; note: string };
  scorePolls: Array<{ startedAt: string; completedAt: string | null; status: string; eligibleGames: number; completedGamesFound: number; finalScoresImported: number; newFinals: number; requestsLast: number; pollingMode: string; quotaProtected: boolean }>;
  incidents: Array<{ id: string; title: string; severity: string; detectedAt: string; lastSeenAt: string; resolvedAt: string | null }>;
  reminders: Array<{ id: string; category: string; title: string; scheduledFor: string; status: string }>;
};

type Filter = "all" | "attention" | "live" | "settled";

const stateLabels: Record<string, string> = { scheduled: "Scheduled", live: "Live", settled: "Settled", needs_review: "Needs review", stale: "Stale", held: "Held" };
const filters: Array<[Filter, string]> = [["all", "All"], ["attention", "Attention"], ["live", "Live"], ["settled", "Settled"]];
const FAST_REFRESH_MS = 60_000;
const QUIET_REFRESH_MS = 15 * 60_000;
const KICKOFF_REFRESH_WINDOW_MS = 15 * 60_000;

function refreshInterval(data: Dashboard | null) {
  if (!data) return FAST_REFRESH_MS;
  if (data.metrics?.live || data.attention.length) return FAST_REFRESH_MS;
  const now = Date.now();
  const kickoffIsNear = data.games.some((game) => {
    if (game.state !== "scheduled") return false;
    const kickoffAt = Date.parse(game.kickoffAt);
    return Number.isFinite(kickoffAt) && Math.abs(kickoffAt - now) <= KICKOFF_REFRESH_WINDOW_MS;
  });
  return kickoffIsNear ? FAST_REFRESH_MS : QUIET_REFRESH_MS;
}

function local(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "-"; }
function shortTime(value: string) { return new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }); }
function percent(part: number, whole: number) { return whole ? Math.round(part / whole * 100) : 0; }

function Progress({ label, done, total, tone }: { label: string; done: number; total: number; tone: string }) {
  return <div className="grading-kpi">
    <p>{label}</p>
    <strong>{done}/{total}</strong>
    <div className="grading-kpi-bar"><div className={tone} style={{ width: `${percent(done, total)}%` }} /></div>
  </div>;
}

function GameInspector({ game }: { game: Dashboard["games"][number] }) {
  return <div className="desk-card">
    <p className="commissioner-tool-eyebrow">GAME INSPECTOR</p>
    <h3 className="mt-1 font-serif text-xl font-bold text-(color:--themed-text-32)">{game.awayName} at {game.homeName}</h3>
    <dl className="grading-facts mt-3">
      <div><dt>State</dt><dd>{stateLabels[game.state] ?? game.state}</dd></div>
      <div><dt>Score</dt><dd>{game.score ?? "Not final"}</dd></div>
      <div><dt>Kickoff</dt><dd>{local(game.kickoffAt)}</dd></div>
      <div><dt>Finalized</dt><dd>{local(game.finalizedAt)}</dd></div>
      {game.finalizedAt ? <div><dt>Graded</dt><dd>{gradedLine(game)}</dd></div> : null}
      <div><dt>Pick&apos;em</dt><dd>{game.picks.graded}/{game.picks.total} graded · {game.picks.pending} pending</dd></div>
      <div><dt>Survivor</dt><dd>{game.survivor.total - game.survivor.pending}/{game.survivor.total} graded · {game.survivor.pending} pending</dd></div>
    </dl>
  </div>;
}

/** When and in which window a finished game was graded: "3h 41m after kickoff · check 4 of 12 (10-min window)". */
function gradedLine(game: { kickoffAt: string; finalizedAt: string | null; gradedWindow?: { rung: number; windowMinutes: number } | null }) {
  const minutes = Math.max(0, Math.round((new Date(game.finalizedAt ?? game.kickoffAt).getTime() - new Date(game.kickoffAt).getTime()) / 60000));
  const elapsed = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
  return `${elapsed} after kickoff${game.gradedWindow ? ` · check ${game.gradedWindow.rung} of 12 (${game.gradedWindow.windowMinutes}-min window)` : ""}`;
}

export default function GradingDashboard({ view = "today" }: { view?: "today" | "performance" | "log" }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [copied, setCopied] = useState(false);
  const periodIdRef = useRef("");
  const requestSequenceRef = useRef(0);
  const inFlightRequestsRef = useRef(0);

  const refresh = useCallback(async (requestedPeriodId = periodIdRef.current) => {
    const requestSequence = ++requestSequenceRef.current;
    inFlightRequestsRef.current += 1;
    setLoading(true); setError("");
    try {
      const response = await fetchWithSession(requestedPeriodId ? `/api/admin/grading-dashboard?periodId=${encodeURIComponent(requestedPeriodId)}` : "/api/admin/grading-dashboard");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The grading dashboard could not load.");
      if (requestSequence !== requestSequenceRef.current) return;
      setData(payload);
      const resolvedPeriodId = payload.period?.id ?? "";
      periodIdRef.current = resolvedPeriodId;
      setPeriodId(resolvedPeriodId);
      setSelectedGameId((current) => current && payload.games.some((game: Dashboard["games"][number]) => game.id === current) ? current : payload.games.find((game: Dashboard["games"][number]) => game.needsAttention)?.id ?? payload.games[0]?.id ?? "");
    } catch (reason) {
      if (requestSequence !== requestSequenceRef.current) return;
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "The grading dashboard could not load.");
    } finally {
      inFlightRequestsRef.current = Math.max(0, inFlightRequestsRef.current - 1);
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => { periodIdRef.current = periodId; }, [periodId]);
  // Fetch immediately once, then adapt the polling cadence to the live workload.
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initial);
  }, [refresh]);
  // Live games, attention items, and nearby kickoffs stay responsive. Quiet
  // periods poll less often; hidden tabs pause and refresh immediately on return.
  const pollingInterval = refreshInterval(data);
  useEffect(() => {
    const refreshIfIdle = () => {
      if (document.visibilityState === "visible" && inFlightRequestsRef.current === 0) void refresh();
    };
    const timer = window.setInterval(refreshIfIdle, pollingInterval);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshOnReturn); };
  }, [pollingInterval, refresh]);

  const filteredGames = useMemo(() => [...(data?.games.filter((game) => filter === "all" || (filter === "attention" ? game.needsAttention : filter === game.state)) ?? [])].sort((left, right) => { const rank = (game: Dashboard["games"][number]) => game.needsAttention ? 0 : game.state === "live" ? 1 : game.picks.pending + game.survivor.pending > 0 ? 2 : game.state === "scheduled" ? 3 : 4; return rank(left) - rank(right) || new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(); }), [data, filter]);
  const metric = data?.metrics;
  const selectedGame = data?.games.find((game) => game.id === selectedGameId) ?? null;
  const openIncidents = data?.incidents.filter((incident) => !incident.resolvedAt) ?? [];
  const resolvedIncidents = data?.incidents.filter((incident) => incident.resolvedAt) ?? [];
  const nextMessage = data?.reminders.find((reminder) => reminder.status === "scheduled");
  const failedRuns = data?.workerRuns.filter((run) => run.status === "failed").length ?? 0;

  async function copySnapshot() {
    if (!data || !metric) return;
    const snapshot = [`Pick'em grading snapshot · ${data.period?.displayName ?? "No period"}`, `Status: ${data.status}`, `Games: ${metric.games} · live ${metric.live} · settled ${metric.settled}`, `Pending grades: ${metric.awaitingGrade} · attention: ${metric.attention}`, `Last score sync: ${local(metric.lastScoreSyncAt)}`, `Credits/final: ${metric.efficiency.creditsPerFinal ?? "-"}`, `Checked: ${local(data.checkedAt)}`].join("\n");
    try { await navigator.clipboard.writeText(snapshot); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }

  return <section className="grading-desk" aria-labelledby="grading-dashboard-title">
    {/* Compact sticky rail on a wider screen: the period picker stays in reach while scrolling. On a phone it scrolls with the page,
        since sticking under the site's own sticky tabs left a strip where the page showed through. */}
    {view !== "log" ? <div className="grading-rail z-20 md:sticky md:top-2 px-5 py-6 sm:px-7"><div className="flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-serif text-3xl sm:text-4xl" id="grading-dashboard-title">{view === "performance" ? "Performance" : "Game day"}</h2></div><div className="flex flex-wrap items-center gap-2">{view === "today" ? <><label className="grading-rail-note text-xs font-bold" htmlFor="grading-period">PERIOD</label><select className="grading-rail-control px-3 py-2 text-sm font-semibold" id="grading-period" onChange={(event) => { setPeriodId(event.target.value); void refresh(event.target.value); }} value={periodId}>{data?.periods.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.status}</option>)}</select><span className="grading-rail-note text-xs">Updated {local(data?.checkedAt ?? null)}</span><button className="grading-rail-control px-3 py-2 text-sm font-bold disabled:opacity-40" disabled={!data} onClick={() => void copySnapshot()} type="button">{copied ? "Copied" : "Copy snapshot"}</button></> : null}<button className="grading-rail-primary px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={() => void refresh()} type="button">{loading ? "Checking." : "Refresh now"}</button></div></div></div> : null}
    {error ? <p className="mt-5 border-l-4 border-(color:--themed-border-24) bg-(color:--themed-bg-24) p-4 font-semibold text-red-900">{error}</p> : null}
    {data?.period && metric ? <>
{view === "today" ? <>
      {/* One status row replaces the old banner, six tiles, and progress bars. */}
      <div className={`grading-status ${data.status === "attention" ? "is-attention" : "is-clear"}`} role="status">
        <div className="grading-status-headline">
          <span>{data.status === "attention" ? "Review queue" : "All clear"}</span>
          <strong>{data.period.displayName} · {metric.live ? `${metric.live} live` : `${metric.settled} of ${metric.games} settled`}</strong>
          <small>{data.attention.length ? `${data.attention.length} item${data.attention.length === 1 ? " needs" : "s need"} review` : "No grading exceptions are open"} · score sync {metric.lastScoreSyncAgeMinutes === null ? "has not run" : `${metric.lastScoreSyncAgeMinutes}m ago`}</small>
        </div>
        <div className="grading-kpis">
          <Progress done={metric.settled} label="Settled" tone="kpi-forest" total={metric.games} />
          <Progress done={metric.gradeCompleteGames} label="Grades complete" tone="kpi-gold" total={metric.gradeEligibleGames} />
          <Progress done={metric.readiness.linesLocked} label="Lines locked" tone="kpi-cognac" total={metric.readiness.lineTotal} />
          <div className={`grading-kpi ${metric.attention ? "is-alert" : ""}`}><p>Attention</p><strong>{metric.attention}</strong><small>{metric.awaitingGrade} picks pending</small></div>
        </div>
      </div>

      {data.attention.length ? <div className="grading-issues" aria-label="Open issues">{data.attention.slice(0, 6).map((item) => <div key={item.id}><p className="font-bold">{item.title}</p><p className="mt-1 text-sm">{item.detail}</p></div>)}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="desk-card overflow-hidden !p-0">
          <div className="desk-card-head flex flex-wrap items-center justify-between gap-3 px-4 py-3"><h3 className="font-serif text-xl">Game pipeline</h3><div className="desk-segment flex p-1 text-xs font-bold">{filters.map(([value, label]) => <button aria-pressed={filter === value} className={`px-2 py-1.5 ${filter === value ? "is-on" : ""}`} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}</div></div>
          <div className="desk-list">{filteredGames.length ? filteredGames.map((game) => <div key={game.id}><button className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left transition ${selectedGameId === game.id ? "is-selected" : ""}`} aria-current={selectedGameId === game.id ? "true" : undefined} aria-expanded={selectedGameId === game.id} onClick={() => setSelectedGameId((current) => current === game.id && window.matchMedia("(max-width: 1023px)").matches ? "" : game.id)} type="button"><div className="min-w-0"><p className="font-bold text-(color:--themed-text-32)">{game.away} <span className="desk-faint">at</span> {game.home}{game.score ? <span className="ml-2 font-semibold text-(color:--themed-text-28)">{game.score}</span> : null}</p><p className="mt-0.5 text-xs text-(color:--themed-text-28)">{shortTime(game.kickoffAt)} · {game.picks.visible ? `${game.picks.graded}/${game.picks.total} Pick'em` : "Picks private"}{game.survivor.total ? ` · ${game.survivor.total - game.survivor.pending}/${game.survivor.total} Survivor` : ""}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${game.needsAttention ? "border-(color:--themed-border-22) bg-red-100 text-red-800" : game.state === "live" ? "border-(color:--themed-border-15) bg-amber-100 text-(color:--themed-text-22)" : "border-zinc-200 bg-zinc-50 text-(color:--themed-text-28)"}`}>{game.needsAttention ? "Review" : stateLabels[game.state] ?? game.state}</span></button>{selectedGameId === game.id ? <div className="px-3 pb-3 lg:hidden"><GameInspector game={game} /></div> : null}</div>) : <p className="p-5 text-sm text-(color:--themed-text-28)">No games match this view.</p>}</div>
        </div>

        <div className="space-y-4">
          <div className="hidden lg:block">{selectedGame ? <GameInspector game={selectedGame} /> : <div className="desk-card text-sm text-(color:--themed-text-28)">Select a game to inspect it.</div>}</div>

        </div>
      </div>

      <div className="desk-card at-glance mt-4">
        <div className="at-glance-col"><h3>Up next</h3>
            <dl className="grading-facts mt-3">
              <div><dt>Next kickoff</dt><dd>{local(metric.readiness.nextKickoffAt)}</dd></div>
              <div><dt>Next line lock</dt><dd>{local(metric.readiness.nextLineLockAt)}</dd></div>
              <div><dt>Next message</dt><dd>{nextMessage ? `${nextMessage.title} · ${local(nextMessage.scheduledFor)}` : "None scheduled"}</dd></div>
              <div><dt>Last score sync</dt><dd>{metric.latestScoreSyncStatus} · {local(metric.lastScoreSyncAt)}</dd></div>
              <div><dt>Schedule</dt><dd>{metric.readiness.scheduleLoaded ? `${metric.games} games loaded` : "No games loaded"}</dd></div>
              <div><dt>Provider allowance</dt><dd>{metric.providerAllowance ?? "Not reported"}</dd></div>
            </dl></div>
        <div className="at-glance-col"><h3>Participant impact</h3><dl className="grading-facts mt-3"><div><dt>Pick&apos;em</dt><dd>{metric.pickOutcomes.win} wins · {metric.pickOutcomes.loss} losses · {metric.pickOutcomes.pending} pending · {metric.pickOutcomes.void} void</dd></div><div><dt>Survivor</dt><dd>{metric.survivorEntries.active === 0 && metric.survivorEntries.complete > 0 ? `Over · ${metric.survivorEntries.complete} ${metric.survivorEntries.complete === 1 ? "winner" : "winners"} · ${metric.survivorEntries.eliminated} eliminated` : `${metric.survivorEntries.active} active · ${metric.survivorEntries.eliminated} eliminated · ${metric.survivorEntries.complete} complete`}</dd></div><div><dt>Active players</dt><dd>{metric.activePlayers}</dd></div></dl></div>
        <div className="at-glance-col"><h3>Notification readiness</h3><dl className="grading-facts mt-3"><div><dt>Queued</dt><dd className={metric.reminders.scheduled || metric.reminders.sending ? "text-(color:--themed-text-21)" : ""}>{metric.reminders.scheduled} scheduled · {metric.reminders.sending} sending</dd></div><div><dt>Delivered</dt><dd>{metric.reminders.sent} sent · {metric.reminders.cancelled} cancelled · {metric.reminders.test} test</dd></div></dl></div>
      </div>
      </> : null}
      {view === "performance" ? <>
            <EfficiencyTrendPanel history={metric.efficiency.history} creditUsage={data.creditUsage} checkedAt={data.checkedAt} summary={metric.efficiency} />
      <section className="desk-card mt-4" aria-label="Fresh finals picked up by polling ladder">
        <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-serif text-xl font-bold">New game finals by polling rung</h3><span className="text-xs font-bold text-(color:--themed-text-27)">Bar width = retry gap · height = share of all finals</span></div>
        <p className="mt-1 text-xs text-(color:--themed-text-27)">Polling starts {FIRST_SCORE_CHECK_DELAY_MINUTES} minutes after kickoff; the bottom axis counts minutes from that first check.</p>
        {data.ladderCoverage?.since ? <p className="mt-1 text-xs text-(color:--themed-text-27)">Every fresh final recorded this season · since {new Date(data.ladderCoverage.since).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })} · found across {formatAdminNumber(data.ladderCoverage.runs)} score checks. Finals before that were not recorded by rung.</p> : null}
        {data.ladderSummary.length ? <div className="mt-3"><LadderHistogram items={data.ladderSummary} /></div> : <p className="mt-3 text-sm text-(color:--themed-text-28)">Fills in as score polls record their retry rung.</p>}
      </section>

      </> : null}
      {view === "log" ? <>
      {/* Logs stay one tap away; they open by themselves when something failed. */}
      <details className="grading-log" open={openIncidents.length > 0 || failedRuns > 0}>
        <summary>Activity log <span>{data.workerRuns.length} worker runs · {data.audit.length} events · {openIncidents.length} open incident{openIncidents.length === 1 ? "" : "s"}</span></summary>
        <div className="mt-3"><h3 className="font-serif text-lg font-bold">Worker activity</h3>{data.workerRuns.length ? <div className="mt-2"><table className="grading-worker-table w-full table-fixed text-left text-sm"><colgroup><col className="w-[20%]" /><col className="w-[14%]" /><col className="w-[33%]" /><col className="w-[33%]" /></colgroup><thead className="border-b border-zinc-300 text-xs uppercase tracking-wide text-(color:--themed-text-27)"><tr><th className="pb-2 pr-3">Worker</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Started</th><th className="pb-2">Completed</th></tr></thead><tbody>{data.workerRuns.map((run, index) => <tr className="border-b border-zinc-100" key={`${run.jobType}-${run.startedAt}-${index}`}><td className="py-2 pr-3 font-semibold">{run.jobType.replaceAll("_", " ")}</td><td className="py-2 pr-3"><span className={`grading-worker-status ${run.status === "success" ? "text-green-800" : run.status === "failed" ? "text-red-800" : "text-(color:--themed-text-21)"}`}>{run.status}</span></td><td className="py-2 pr-3 text-xs text-(color:--themed-text-28)">{local(run.startedAt)}</td><td className="py-2 text-xs text-(color:--themed-text-28)">{run.completedAt ? local(run.completedAt) : run.error ?? "Still running"}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-(color:--themed-text-28)">No score or line-lock worker runs recorded.</p>}</div>
        <div className="mt-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-serif text-lg font-bold">Recent operational history</h3>{data.audit.length > 3 ? <button aria-expanded={showAllAudit} className="text-xs font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900" onClick={() => setShowAllAudit((current) => !current)} type="button">{showAllAudit ? "Show latest 3" : `Show all ${data.audit.length}`}</button> : null}</div>{data.audit.length ? <ol className="mt-2 divide-y divide-zinc-200">{data.audit.slice(0, showAllAudit ? data.audit.length : 3).map((entry) => <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm" key={entry.id}><span><strong>{entry.action.replaceAll("_", " ")}</strong><span className="ml-2 text-(color:--themed-text-27)">{entry.entityType}</span></span><time className="text-xs text-(color:--themed-text-27)" dateTime={entry.createdAt}>{local(entry.createdAt)}</time></li>)}</ol> : <p className="mt-2 text-sm text-(color:--themed-text-28)">No recent grading events.</p>}</div>
        <section className="mt-4" aria-label="Incident posture"><h3 className="font-serif text-lg font-bold">Incident posture</h3>{openIncidents.length ? <ul className="mt-2 divide-y divide-red-100 border-l-2 border-(color:--themed-border-24) bg-(color:--themed-bg-24)">{openIncidents.map((incident) => <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm" key={incident.id}><span className="font-semibold">{incident.title} <span className="ml-2 text-xs font-black uppercase tracking-wide text-red-800">{incident.severity}</span></span><span className="text-xs text-(color:--themed-text-28)">Detected {local(incident.detectedAt)} · last seen {local(incident.lastSeenAt)}</span></li>)}</ul> : <p className="mt-2 rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900">No open watchdog incidents.</p>}{resolvedIncidents.length ? <details className="mt-2 border-t border-zinc-200 pt-2"><summary className="cursor-pointer text-xs font-bold text-(color:--themed-text-28) hover:text-(color:--themed-text-31)">Show {resolvedIncidents.length} resolved incidents</summary><ul className="mt-2 divide-y divide-zinc-100">{resolvedIncidents.map((incident) => <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm" key={incident.id}><span className="font-semibold">{incident.title} <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-(color:--themed-text-27)">Resolved</span></span><span className="text-xs text-(color:--themed-text-27)">Detected {local(incident.detectedAt)} · cleared {local(incident.resolvedAt)}</span></li>)}</ul></details> : null}</section>
      </details>
      </> : null}
    </> : loading ? <div className="mt-6 h-48 animate-pulse bg-(color:--fill-track-strong)" aria-label="Loading grading dashboard" /> : null}
  </section>;
}
