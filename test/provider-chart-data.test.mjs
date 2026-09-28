import assert from "node:assert/strict";
import test from "node:test";
import { latestProviderCreditSnapshot, monthlyCreditSeries, slateEfficiencySeries } from "../src/lib/provider-chart-data.js";
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
