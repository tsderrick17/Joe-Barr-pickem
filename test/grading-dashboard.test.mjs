import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("grading dashboard exposes a game pipeline and actionable attention queue", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/grading-dashboard.tsx", import.meta.url), "utf8");
  const pollingComponent = await readFile(new URL("../src/components/polling-strategy-panel.tsx", import.meta.url), "utf8");

  assert.match(route, /needs_review/);
  assert.match(route, /lastScoreSyncAgeMinutes/);
  assert.match(route, /watchdog\.openAlerts/);
  assert.match(route, /audit_logs/);
  assert.match(route, /pick grades are still pending/);
  assert.match(component, /id="grading-dashboard-title">Grading</);
  assert.match(component, /Game pipeline/);
  assert.match(component, /Review queue/);
  assert.match(component, /Recent operational history/);
  assert.match(component, /Participant impact/);
  assert.match(component, /Notification readiness/);
  assert.match(component, /Up next/);
  assert.match(component, /Provider performance/);
  assert.match(component, /Activity log/);
  // The old text sanitizer that rewrote every "?" is gone; separators are real.
  assert.doesNotMatch(component, /MutationObserver/);
  assert.match(component, /<EfficiencyTrendPanel/);
  assert.match(component, /<LadderHistogram items=\{data\.ladderSummary\}/);
  assert.match(component, /New game finals by polling rung/);
  assert.match(route, /summarizeProviderEfficiency/);
  assert.match(route, /periodId/);
  assert.match(component, /aria-labelledby="grading-dashboard-title"/);
  assert.match(component, /grading-period/);
  assert.match(component, /requestSequenceRef/);
  assert.match(component, /requestSequence !== requestSequenceRef\.current/);
  assert.match(component, /useCallback\(async \(requestedPeriodId = periodIdRef\.current\)/);
  assert.match(component, /useEffect\(\(\) => \{ periodIdRef\.current = periodId; \}, \[periodId\]\)/);
  assert.match(component, /Worker activity/);
  assert.match(route, /workerRuns/);
  // Worker activity covers every worker: the latest run of each job, never a window of mixed rows.
  assert.match(route, /\["line_locks", "bowl_scores"\]\.map\(\(jobType\) =>/);
  assert.match(route, /latestWorkerRuns\(\[\.\.\.\(syncResult\.data \?\? \[\]\), \.\.\.\(lineLockRunsResult\.data \?\? \[\]\), \.\.\.\(bowlRunsResult\.data \?\? \[\]\)\]\)/);
  // "Last score sync" reads score runs only, so a line-lock or bowl run can never stand in for it.
  assert.match(route, /\.eq\("job_type", "scores"\)\.order\("started_at", \{ ascending: false \}\)\.limit\(60\)/);
  assert.match(component, /GAME INSPECTOR/);
  assert.match(component, /Copy snapshot/);
  assert.match(component, /Incident posture/);
  assert.match(route, /recentAlerts/);
  assert.match(route, /settlementLatency/);
  assert.match(route, /previousAverageMinutes/);
  assert.match(route, /firstCheckMinutesAfterKickoff/);
  assert.match(route, /cronIntervalMinutes: 10/);
  assert.match(route, /GAME_STATUS_GRACE_MINUTES = 15/);
  assert.match(route, /staleAfter = new Date\(game\.kickoff_at\)\.getTime\(\) \+ GAME_STATUS_GRACE_MINUTES/);
  assert.match(route, /scorePolls/);
  assert.match(route, /ladderSummary/);
  assert.match(pollingComponent, /Histogram of new fresh final scores by polling interval/);
  assert.match(route, /newFinalsPercentage/);
  assert.match(route, /SCORE_POLLING_RETRY_MINUTES/);
  const efficiencyComponent = await readFile(new URL("../src/components/efficiency-trend-panel.tsx", import.meta.url), "utf8");
  const slateComponent = await readFile(new URL("../src/components/slate-performance-panel.tsx", import.meta.url), "utf8");
  assert.match(route, /efficiencyHistory/);
  assert.match(efficiencyComponent, /SlatePerformancePanel history=/);
  assert.match(slateComponent, /Provider cost &amp; settlement/);
  assert.match(slateComponent, /rollingCreditsPerGame15Days/);
  assert.match(slateComponent, /rightAxis=\{\{ label: "Minutes to final"/);
  assert.doesNotMatch(slateComponent, /Game and period latency details|<details/);
  assert.doesNotMatch(slateComponent, /Productive checks/);
});

test("grading dashboard keeps the current scoring period and reminder signals together", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /displayName: period\.display_name/);
  assert.match(route, /reminders:/);
  assert.match(route, /providerAllowance/);
});

test("the polling histogram covers every recorded fresh final this season, not a window of recent runs", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/grading-dashboard.tsx", import.meta.url), "utf8");
  // A dedicated, paged read of score runs that recorded a rung, from the start of the season.
  const ladder = await readFile(new URL("../src/lib/season-ladder.ts", import.meta.url), "utf8");
  assert.match(ladder, /\.select\("started_at, ladder:details->ladderRungs"\)/);
  assert.match(ladder, /\.eq\("job_type", "scores"\)\.not\("details->ladderRungs", "is", null\)/);
  assert.match(ladder, /\.range\(offset, offset \+ 999\)/);
  assert.match(ladder, /if \(\(data \?\? \[\]\)\.length < 1000\) break;/);
  assert.match(route, /loadSeasonLadder\(supabaseAdmin, seasonStart\)/);
  assert.match(route, /seasonLadder\(new Date\(Date\.UTC\(season\.year, 0, 1\)\)\.toISOString\(\), now\)/);
  // The old shortcut, counting rungs from the newest mixed rows, is gone.
  assert.doesNotMatch(route, /for \(const run of syncResult\.data \?\? \[\]\)/);
  // A failure blanks only this chart, and the page says what span it covers.
  assert.match(route, /The score-polling histogram could not be loaded\./);
  assert.match(route, /ladderCoverage: \{ since: ladder\.since, runs: ladder\.runs \}/);
  assert.match(component, /Every fresh final recorded this season/);
});

test("efficiency totals are season to date instead of a rolling month", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /firstKickoff - 3 \* 86400000/);
  assert.doesNotMatch(route, /now\.getTime\(\) - 30 \* 86400000\)\), now\)/);
});
