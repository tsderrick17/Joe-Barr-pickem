import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWatchdogSignals, isConfigurationDriftCheckDue, isWatchdogRepeatNotificationDue, isWeeklyStoragePruneDue } from "../src/lib/watchdog-rules.js";

function healthy(overrides = {}) {
  return {
    missingOfficialLines: 0, scoreChecksDueNow: 0, scoreCandidates: 0,
    scoreProviderFailureStreak: 0, providerAllowance: 100,
    latestScores: { status: "success", started_at: "2026-08-20T12:00:00Z", completed_at: "2026-08-20T12:01:00Z" },
    reminderHealth: { overdueScheduled: 0, staleSending: 0, recentEmailFailures: 0 },
    pendingScheduleReviews: 0, scheduleProviderCircuit: null, pinAttackIncidents: [], ...overrides,
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

test("watchdog alerts the Commissioner when ten distinct invalid PINs are tried", () => {
  const signals = evaluateWatchdogSignals({
    health: healthy({ pinAttackIncidents: [{ id: "security-incident", attempted_pins: 10 }] }),
    bootstrap: completeBootstrap, preflightChecks: [], now: new Date("2026-08-20T12:10:00Z"),
  });
  assert.deepEqual(signals, [{
    key: "suspicious-pin-attempts-security-incident", severity: "critical",
    title: "Suspicious PIN guessing detected",
    detail: "10 different invalid PINs were tried from one privacy-safe source fingerprint within 15 minutes. No raw PINs, network addresses, or player picks were stored in the alert.",
  }]);
});

// When the score worker is paused for the month's credits it stops on purpose, so "scores are stalled" would be a false alarm; the one alert that
// is raised instead says that the credits are the reason. The tier (Normal, Lean, Minimal, paused) comes from score-polling-tier.js.
const pausedTier = { tier: "paused", message: "Paused: 12 credits left and the rest of the month's official lines need about 15 credits. The Run score check now button still works." };
const lowCredits = (overrides = {}) => healthy({
  scoreChecksDueNow: 3, providerAllowance: 12, scoreTier: pausedTier,
  latestScores: { status: "failed", started_at: "2026-08-20T10:00:00Z", completed_at: "2026-08-20T10:01:00Z" },
  ...overrides,
});
const evaluateAt = (health, now = "2026-08-20T13:00:00Z", bootstrap = completeBootstrap) => evaluateWatchdogSignals({ health, bootstrap, preflightChecks: [{ label: "Cron", passed: true }], now: new Date(now) });

test("paused score checks raise one alert that names the credits, not a stalled-scores alarm", () => {
  assert.deepEqual(evaluateAt(lowCredits()), [{
    key: "score-polling-paused", severity: "critical",
    title: "Score checks are paused to protect the official lines",
    detail: `${pausedTier.message} NFL games will not be graded automatically until the credits renew on the 1st. "Run score check now" under Emergency manual controls still works (2 credits a tap).`,
  }]);
});

test("Lean and Minimal are a heads-up, not an emergency: every game is still graded, only later", () => {
  for (const [tier, name] of [["lean", "Lean"], ["minimal", "Minimal"]]) {
    const scoreTier = { tier, message: `${name}: 31 credits are free for scores after the lines, and Lean needs about 30 credits for the 2 game days left.` };
    const signals = evaluateAt(healthy({ scoreTier }));
    assert.deepEqual(signals.map((signal) => [signal.key, signal.severity, signal.title]), [["score-polling-reduced", "warning", `Score checks are on the ${name} schedule to save credits`]]);
    assert.match(signals[0].detail, /only later than usual; Normal checking returns when the credits renew on the 1st/);
  }
});

test("the score-tier alerts are quiet on Normal, with no tier reported, and after the season is over", () => {
  assert.deepEqual(evaluateAt(healthy({ scoreTier: { tier: "normal", message: "Normal: 45 credits used." } })), []);
  assert.deepEqual(evaluateAt(healthy({ providerAllowance: null, providerCreditSnapshot: null })), [], "no tier reported says nothing");
  assert.deepEqual(evaluateAt(lowCredits(), "2026-08-20T13:00:00Z", { ...completeBootstrap, seasonState: "complete" }), [], "after the Super Bowl nobody is waiting for grades");
  assert.deepEqual(evaluateAt(healthy({ scoreTier: { tier: "lean", message: "Lean: ..." } }), "2026-08-20T13:00:00Z", { ...completeBootstrap, seasonState: "complete" }), []);
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

test("the configuration alert names the reason each check failed", () => {
  const signals = evaluateWatchdogSignals({
    health: healthy(), bootstrap: completeBootstrap, now: new Date("2026-08-20T13:00:00Z"),
    preflightChecks: [
      { label: "NFL odds provider", passed: false, detail: "Provider authentication or NFL availability failed (HTTP 401)." },
      { label: "Watchdog cron", passed: false },
      { label: "Brevo delivery account", passed: true, detail: "fine" },
    ],
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].detail, "NFL odds provider (Provider authentication or NFL availability failed (HTTP 401).); Watchdog cron");
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

test("configuration drift runs once per Eastern day and retries failures hourly", () => {
  const now = new Date("2026-08-20T16:00:00Z");
  assert.equal(isConfigurationDriftCheckDue(null, now), true);
  assert.equal(isConfigurationDriftCheckDue({ status: "success", started_at: "2026-08-20T12:00:00Z" }, now), false);
  assert.equal(isConfigurationDriftCheckDue({ status: "success", started_at: "2026-08-19T23:59:00-04:00" }, now), true);
  assert.equal(isConfigurationDriftCheckDue({ status: "failed", started_at: "2026-08-20T15:30:00Z" }, now), false);
  assert.equal(isConfigurationDriftCheckDue({ status: "failed", started_at: "2026-08-20T14:59:00Z" }, now), true);
  assert.equal(isConfigurationDriftCheckDue({ status: "started", started_at: "2026-08-20T14:59:00Z" }, now), true);
  assert.equal(isConfigurationDriftCheckDue({ status: "failed", started_at: "not-a-date" }, now), true);
});

test("storage is pruned once a week, counted from the last prune, and retried when that is unknown or unreadable", () => {
  const now = new Date("2026-08-20T16:00:00Z");
  assert.equal(isWeeklyStoragePruneDue(null, now), true, "never pruned");
  assert.equal(isWeeklyStoragePruneDue("2026-08-13T16:00:01Z", now), false, "a second short of a week");
  assert.equal(isWeeklyStoragePruneDue("2026-08-13T16:00:00Z", now), true, "exactly a week");
  assert.equal(isWeeklyStoragePruneDue("2026-08-20T15:59:00Z", now), false, "pruned a minute ago");
  assert.equal(isWeeklyStoragePruneDue("not-a-date", now), true);
});

test("watchdog quiets a resolved incident for six hours, then allows a meaningful repeat", () => {
  const notifiedAt = "2026-08-20T12:00:00Z";
  assert.equal(isWatchdogRepeatNotificationDue(notifiedAt, new Date("2026-08-20T17:59:59Z")), false);
  assert.equal(isWatchdogRepeatNotificationDue(notifiedAt, new Date("2026-08-20T18:00:00Z")), true);
  assert.equal(isWatchdogRepeatNotificationDue(null, new Date("2026-08-20T12:00:00Z")), true);
  assert.equal(isWatchdogRepeatNotificationDue("not-a-date", new Date("2026-08-20T12:00:00Z")), true);
});

test("a stuck-message alert names the messages that are waiting", () => {
  const signal = evaluateWatchdogSignals({
    health: healthy({ reminderHealth: { overdueScheduled: 2, overdueTitles: ["Final lines", "Sunday final lines"], staleSending: 0, recentEmailFailures: 0 } }),
    bootstrap: completeBootstrap, preflightChecks: [{ label: "Cron", passed: true }],
    now: new Date("2026-08-20T12:10:00Z"),
  }).find((item) => item.key === "stalled-reminders");
  assert.match(signal.detail, /Waiting: Final lines; Sunday final lines./);
});
