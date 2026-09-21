import test from "node:test";
import assert from "node:assert/strict";
import { recommendPollingPlan, simulatePollingPlans } from "../src/lib/polling-plan.js";

test("polling simulator projects predictable weekly and monthly credit costs", () => {
  const plans = simulatePollingPlans({ games: 16 });
  assert.equal(plans.length, 3);
  assert.equal(plans[0].weeklyCredits, 96);
  assert.equal(plans[2].periodCredits, 320);
  assert.ok(plans[2].monthlyCredits > plans[0].monthlyCredits);
});

test("recommendation favors responsiveness only when settlement latency is high", () => {
  assert.equal(recommendPollingPlan({ settlementAverageMinutes: 90 }), "responsive");
  assert.equal(recommendPollingPlan({ observedCreditsPerFinal: 5, settlementAverageMinutes: 30 }), "balanced");
  assert.equal(recommendPollingPlan({ observedCreditsPerFinal: 12, settlementAverageMinutes: 30 }), "conservative");
});
