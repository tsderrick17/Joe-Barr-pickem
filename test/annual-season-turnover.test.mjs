import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { evaluateWatchdogSignals } from "../src/lib/watchdog-rules.js";

test("annual turnover is certified, retry-safe, and preserves official history", async () => {
  const [migration, rollover, bootstrap, panel] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260820010000_add_certified_annual_turnover.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/season-rollover.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/full-schedule-bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/season-bootstrap-status.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table if not exists public\.season_turnover_runs/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /status in \('blocked', 'completed'\)/);
  assert.match(migration, /previous season is not marked complete/i);
  assert.match(migration, /selections are ungraded/i);
  assert.match(migration, /championship has not been recorded/i);
  assert.match(migration, /revision_number > 1/);
  assert.match(migration, /slate_selections_saved/);
  assert.match(migration, /snapshot_number > 1/);
  assert.match(migration, /prune_operational_storage/);
  assert.match(migration, /insert into public\.survivor_entries/);
  assert.doesNotMatch(migration, /delete from public\.(picks|survivor_picks|game_lines|email_reminder_deliveries|push_reminder_deliveries)/i);
  assert.match(migration, /season_turnover_completed/);
  assert.match(migration, /existing_run\.status = 'completed'/);

  assert.match(rollover, /ensure_annual_season_rollover/);
  assert.match(rollover, /perform_annual_season_turnover/);
  assert.match(bootstrap, /season_turnover_runs/);
  assert.match(panel, /season turnover is certified/i);
  assert.match(panel, /Official games, lines, picks, championships, and message receipts were preserved/);
});

test("watchdog raises one actionable alert when annual turnover is blocked", () => {
  const signals = evaluateWatchdogSignals({
    health: {
      missingOfficialLines: 0, scoreChecksDueNow: 0, scoreCandidates: 0,
      scoreProviderFailureStreak: 0, providerAllowance: 100,
      latestScores: { status: "success", started_at: "2026-08-20T12:00:00Z", completed_at: "2026-08-20T12:01:00Z" },
      reminderHealth: { overdueScheduled: 0, staleSending: 0, recentEmailFailures: 0 },
      pendingScheduleReviews: 0, scheduleProviderCircuit: null, pinAttackIncidents: [],
    },
    bootstrap: {
      seasonYear: 2026, loadedGames: 272, complete: true, seasonState: "preseason",
      turnover: { status: "blocked", blockers: ["The previous season is not marked complete."] },
    },
    preflightChecks: [],
    now: new Date("2026-08-20T12:10:00Z"),
  });

  assert.deepEqual(signals, [{
    key: "annual-season-turnover-blocked",
    severity: "critical",
    title: "Annual season turnover needs review",
    detail: "The previous season is not marked complete.",
  }]);
});
