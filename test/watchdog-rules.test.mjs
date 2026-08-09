import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWatchdogSignals } from "../src/lib/watchdog-rules.js";

function healthy(overrides = {}) {
  return {
    missingOfficialLines: 0, scoreChecksDueNow: 0, scoreCandidates: 0,
    scoreProviderFailureStreak: 0, providerAllowance: 100,
    latestScores: { status: "success", started_at: "2026-08-20T12:00:00Z", completed_at: "2026-08-20T12:01:00Z" },
    reminderHealth: { overdueScheduled: 0, staleSending: 0, recentEmailFailures: 0 },
    pendingScheduleReviews: 0, scheduleProviderCircuit: null, ...overrides,
  };
}

const completeBootstrap = { seasonYear: 2026, loadedGames: 272, complete: true, seasonState: "preseason" };

test("watchdog stays quiet for healthy automation and isolated email failures", () => {
  const signals = evaluateWatchdogSignals({
    health: healthy({ reminderHealth: { overdueScheduled: 0, staleSending: 0, recentEmailFailures: 3 } }),
    bootstrap: completeBootstrap, preflightChecks: [{ label: "Cron", passed: true }],
    now: new Date("2026-08-20T12:10:00Z"),
  });
  assert.deepEqual(signals, []);
});

test("watchdog stays quiet while provider quota protection intentionally pauses score checks", () => {
  const signals = evaluateWatchdogSignals({
    health: healthy({
      scoreChecksDueNow: 3,
      providerAllowance: 12,
      latestScores: { status: "failed", started_at: "2026-08-20T10:00:00Z", completed_at: "2026-08-20T10:01:00Z" },
    }),
    bootstrap: completeBootstrap,
    preflightChecks: [{ label: "Cron", passed: true }],
    now: new Date("2026-08-20T13:00:00Z"),
  });
  assert.deepEqual(signals, []);
});

test("watchdog emits only actionable line, scoring, queue, schedule, and configuration incidents", () => {
  const signals = evaluateWatchdogSignals({
    health: healthy({
      missingOfficialLines: 2, scoreChecksDueNow: 1,
      latestScores: { status: "failed", started_at: "2026-08-20T10:00:00Z", completed_at: "2026-08-20T10:01:00Z" },
      reminderHealth: { overdueScheduled: 1, staleSending: 0, recentEmailFailures: 0 }, pendingScheduleReviews: 1,
    }),
    bootstrap: { ...completeBootstrap, loadedGames: 0, complete: false },
    preflightChecks: [{ label: "Watchdog cron", passed: false }],
    now: new Date("2026-08-20T13:00:00Z"),
  });
  assert.deepEqual(signals.map((signal) => signal.key), [
    "missing-official-lines", "stalled-final-scores", "stalled-reminders", "schedule-change-review-needed",
    "season-schedule-missing", "automation-configuration-missing",
  ]);
});

test("schedule alert waits until August 15 while automatic retries are expected", () => {
  const input = { health: healthy(), bootstrap: { ...completeBootstrap, loadedGames: 0, complete: false }, preflightChecks: [] };
  assert.equal(evaluateWatchdogSignals({ ...input, now: new Date("2026-08-14T16:00:00Z") }).length, 0);
  assert.equal(evaluateWatchdogSignals({ ...input, now: new Date("2026-08-15T16:00:00Z") })[0].key, "season-schedule-missing");
});

test("watchdog waits for repeated provider failures before raising one actionable incident", () => {
  const scoreSignal = evaluateWatchdogSignals({
    health: healthy({
      scoreCandidates: 2,
      scoreProviderFailureStreak: 3,
      latestScores: { status: "failed", started_at: "2026-08-20T12:00:00Z", completed_at: "2026-08-20T12:01:00Z" },
    }),
    bootstrap: completeBootstrap,
    now: new Date("2026-08-20T12:10:00Z"),
  });
  assert.deepEqual(scoreSignal.map((signal) => signal.key), ["stalled-final-scores"]);

  const scheduleSignal = evaluateWatchdogSignals({
    health: healthy({
      scheduleProviderCircuit: { consecutive_failures: 3, next_retry_at: "2026-08-21T00:00:00Z" },
    }),
    bootstrap: completeBootstrap,
    now: new Date("2026-08-20T12:10:00Z"),
  });
  assert.deepEqual(scheduleSignal.map((signal) => signal.key), ["schedule-provider-cooldown"]);
});
