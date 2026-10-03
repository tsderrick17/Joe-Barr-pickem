import assert from "node:assert/strict";
import test from "node:test";
import { expectedScoreChecks, firstHourSettleShare, latestProviderCreditSnapshot, monthlyCreditSeries, rollingCreditsPerGame15Days, slateEfficiencySeries } from "../src/lib/provider-chart-data.js";
import { providerRequestCost } from "../src/lib/provider-efficiency.js";

test("monthly credits include charged failures, zero days and only the current month through now", () => {
  const run = (at, cost, extra = {}) => ({ started_at: at, status: "failed", job_type: "scores", details: { requestsLast: cost, ...extra } });
  const result = monthlyCreditSeries([
    run("2026-08-31T23:59:00Z", 20),
    run("2026-09-01T01:00:00Z", 2, { requestsUsed: "12", requestsRemaining: "488" }),
    run("2026-09-03T01:00:00Z", 3),
    run("2026-09-03T23:00:00Z", 99),
    run("2026-10-01T00:00:00Z", 99),
  ], new Date("2026-09-03T12:00:00Z"));
  assert.deepEqual(result.days.map((day) => day.credits), [2, 0, 3]);
  assert.deepEqual(result.days.map((day) => day.cumulative), [2, 2, 5]);
  assert.equal(result.reportedUsed, 12);
  assert.equal(result.remaining, 488);
  assert.equal(result.trackedCredits, 5);
});

test("missing costs use estimates, explicit zero stays free and quota null is unknown", () => {
  const run = { started_at: "2026-09-01T12:00:00Z", job_type: "scores", details: { providerChecked: true, requestsLast: null, requestsUsed: null, requestsRemaining: null } };
  assert.equal(providerRequestCost(run), 2);
  assert.equal(providerRequestCost({ ...run, details: { ...run.details, requestsLast: "0" } }), 0);
  const data = monthlyCreditSeries([run], new Date("2026-09-01T13:00:00Z"));
  assert.equal(data.days[0].estimatedCalls, 1);
  assert.equal(data.reportedUsed, null);
  assert.equal(data.remaining, null);
});

test("every dashboard uses the newest coherent provider balance regardless of worker", () => {
  const snapshot = latestProviderCreditSnapshot([
    { started_at: "2026-09-20T12:00:00Z", job_type: "scores", details: { requestsUsed: "196", requestsRemaining: "304" } },
    { started_at: "2026-09-20T12:05:00Z", job_type: "line_locks", details: { requestsUsed: "197", requestsRemaining: "303" } },
    { started_at: "2026-09-20T12:10:00Z", job_type: "scores", details: { requestsUsed: null, requestsRemaining: null } },
  ]);
  assert.equal(snapshot.used, 197);
  assert.equal(snapshot.remaining, 303);
  assert.equal(snapshot.limit, 500);
  assert.equal(snapshot.reportedAt, "2026-09-20T12:05:00.000Z");
});

test("monthly credit forecast covers the full month and pools nearby kickoff windows", () => {
  const result = monthlyCreditSeries([], new Date("2026-09-10T12:00:00Z"), [
    { kickoff_at: "2026-09-12T17:00:00Z" },
    { kickoff_at: "2026-09-12T17:25:00Z" },
    { kickoff_at: "2026-09-12T18:00:01Z" },
  ]);
  assert.equal(result.days.length, 10);
  assert.equal(result.calendarDays.length, 30);
  assert.equal(result.calendarDays[11].forecastSlates, 2);
  assert.equal(result.calendarDays[11].forecastGames, 3);
  assert.ok(result.forecastCredits > 0);
  assert.equal(result.forecastTotal, result.trackedCredits + result.forecastCredits);
  assert.match(result.forecastAssumptions, /90%/);
});

test("regular-season Sunday average counts elapsed game Sundays only", () => {
  const result = monthlyCreditSeries([
    { started_at: "2026-09-13T17:00:00Z", job_type: "scores", details: { requestsLast: 6 } },
    { started_at: "2026-09-13T18:00:00Z", job_type: "line_locks", details: { requestsLast: 2 } },
    { started_at: "2026-09-20T17:00:00Z", job_type: "scores", details: { requestsLast: 40 } },
  ], new Date("2026-09-14T12:00:00Z"), [], undefined, [
    "2026-09-13T17:00:00Z", "2026-09-20T17:00:00Z", "2026-09-27T17:00:00Z",
  ]);
  assert.equal(result.regularSundaysElapsed, 1);
  assert.equal(result.sundayAverageCredits, 8);
});

test("slates pool kickoffs within 30 minutes and never absorb later unrelated polls", () => {
  const games = [{ kickoff_at: "2026-09-20T17:00:00Z", finalized_at: "2026-09-20T20:30:00Z" }];
  const rows = [
    { started_at: "2026-09-20T20:00:00Z", job_type: "scores", details: { requestsLast: 2, newFinals: 1 } },
    { started_at: "2026-09-21T23:00:00Z", job_type: "scores", details: { requestsLast: 20, newFinals: 5 } },
  ];
  const result = slateEfficiencySeries(games, rows, new Date("2026-09-22T00:00:00Z"));
  assert.equal(result[0].credits, 2);
  assert.equal(result[0].creditsPerFinal, 2);
  assert.equal(result[0].productiveRate, 100);
});

test("kickoffs more than 30 minutes apart remain separate slates", () => {
  const games = [
    { kickoff_at: "2026-09-20T17:00:00Z", finalized_at: "2026-09-20T20:30:00Z" },
    { kickoff_at: "2026-09-20T17:30:01Z", finalized_at: "2026-09-20T20:30:00Z" },
  ];
  const result = slateEfficiencySeries(games, [], new Date("2026-09-22T00:00:00Z"));
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((point) => point.games), [1, 1]);
});

test("pooled slates avoid false overlap; future games never appear", () => {
  const games = [
    { kickoff_at: "2026-09-20T20:05:00Z", finalized_at: "2026-09-21T00:30:00Z" },
    { kickoff_at: "2026-09-20T20:25:00Z", finalized_at: "2026-09-21T00:30:00Z" },
    { kickoff_at: "2026-09-25T20:25:00Z", finalized_at: null },
  ];
  const result = slateEfficiencySeries(games, [{ started_at: "2026-09-20T23:30:00Z", job_type: "scores", details: { requestsLast: 2, newFinals: 1 } }], new Date("2026-09-22T00:00:00Z"));
  assert.equal(result.length, 1);
  assert.equal(result[0].games, 2);
  assert.equal(result[0].creditsPerFinal, 2);
  assert.equal(result[0].attribution, "estimated");
});

test("combined slate points use one settled-game denominator and pooled-kickoff latency", () => {
  const games = [
    { kickoff_at: "2026-10-01T17:00:00Z", finalized_at: "2026-10-01T20:30:00Z", status: "final" },
    { kickoff_at: "2026-10-01T17:20:00Z", finalized_at: "2026-10-01T20:40:00Z", status: "final" },
  ];
  const runs = [{ started_at: "2026-10-01T20:00:00Z", job_type: "scores", details: { requestsLast: 6, newFinals: 2 } }];
  const [point] = slateEfficiencySeries(games, runs, new Date("2026-10-02T00:00:00Z"));
  assert.equal(point.settledGames, 2);
  assert.equal(point.creditsPerGame, 3);
  assert.equal(point.latencyMinutes, 195);
  assert.equal(rollingCreditsPerGame15Days([point], 0), 3);
  const incomplete = slateEfficiencySeries([{ ...games[0], finalized_at: null, status: "scheduled" }], runs, new Date("2026-10-02T00:00:00Z"))[0];
  assert.equal(incomplete.creditsPerGame, null);
  assert.equal(incomplete.latencyMinutes, null);
});

test("15-day credits per game averages by Eastern calendar date and weights games", () => {
  const point = (slateStartedAt, credits, settledGames) => ({ slateStartedAt, credits, settledGames, creditsPerGame: credits / settledGames });
  const history = [
    point("2026-10-01T17:00:00Z", 4, 1),
    point("2026-10-15T17:00:00Z", 6, 2),
    point("2026-10-16T17:00:00Z", 8, 1),
  ];
  assert.equal(rollingCreditsPerGame15Days(history, 1), 10 / 3);
  assert.equal(rollingCreditsPerGame15Days(history, 2), 14 / 3);
  assert.equal(rollingCreditsPerGame15Days([...history, { ...point("2026-10-17T17:00:00Z", 0, 1), creditsPerGame: null }], 3), null);
});

test("score checks follow the retry ladder and the measured first-hour share", () => {
  const ladder = [10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240];
  const base = expectedScoreChecks(ladder, 0.9);
  assert.deepEqual([base.firstHour, base.nextHour, base.cooldown], [6, 3, 1]);
  // 90% finish by check 6; 5% use 6 + a 1-3 check mean of 2; 5% reach the cooldown check (6 + 3 + 1).
  assert.ok(Math.abs(base.checks - (0.9 * 6 + 0.05 * 8 + 0.05 * 10)) < 1e-9);
  assert.ok(expectedScoreChecks(ladder, 0.99).checks < base.checks);
  assert.ok(expectedScoreChecks(ladder, 0.6).checks > base.checks);
});

test("the first-hour share is a 15-day average of settled slates, with a 90% prior until there is history", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const slate = (kickoff, minutesAfterPollingStart) => {
    const pollingStart = Date.parse(kickoff) + 170 * 60000;
    return [{ kickoff_at: kickoff, finalized_at: new Date(pollingStart + minutesAfterPollingStart * 60000).toISOString() }];
  };
  assert.deepEqual(firstHourSettleShare([], now), { share: 0.9, slates: 0, measured: false });
  const games = [
    ...slate("2026-10-06T17:00:00Z", 30), ...slate("2026-10-07T00:20:00Z", 45), ...slate("2026-10-13T17:00:00Z", 20), ...slate("2026-10-14T00:15:00Z", 130),
    // Older than 15 days: ignored.
    ...slate("2026-09-13T17:00:00Z", 500),
  ];
  const result = firstHourSettleShare(games, now);
  assert.equal(result.measured, true);
  assert.equal(result.slates, 4);
  assert.equal(result.share, 0.75);
});

test("line requests: a 7 AM refresh each day plus one fetch per distinct lock time, including 6 PM early locks", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const games = [
    // Sunday 9:30 AM ET international kickoff: locks Saturday 6 PM ET.
    { kickoff_at: "2026-10-04T13:30:00Z" },
    // Sunday 1 PM games share one 8 AM Sunday lock.
    { kickoff_at: "2026-10-04T17:00:00Z" }, { kickoff_at: "2026-10-04T17:00:00Z" },
    // Sunday night game: same Sunday 8 AM lock moment.
    { kickoff_at: "2026-10-05T00:20:00Z" },
  ];
  const result = monthlyCreditSeries([], now, games);
  const byDate = Object.fromEntries(result.calendarDays.map((day) => [day.date.slice(0, 10), day]));
  assert.equal(byDate["2026-10-03"].forecastLockFetches, 1);
  assert.equal(byDate["2026-10-04"].forecastLockFetches, 1);
  assert.equal(byDate["2026-10-02"].forecastLockFetches, 0);
  assert.equal(byDate["2026-10-02"].forecastRefreshes, 1);
  assert.equal(byDate["2026-10-03"].forecastLines, 2);
  assert.equal(byDate["2026-10-02"].forecastLines, 1);
});
