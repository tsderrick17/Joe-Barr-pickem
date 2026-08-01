import assert from "node:assert/strict";
import test from "node:test";
import { assessOpeningWeekChecklist } from "../src/lib/opening-week-checklist.js";

const period = { id: "week-1", display_name: "Week 1", display_order: 1, period_type: "regular", status: "upcoming", max_picks: 2 };
const game = { id: "game-1", scoring_period_id: "week-1", kickoff_at: "2026-09-13T17:00:00Z", line_lock_at: "2026-09-13T12:00:00Z", away_team_id: "away", home_team_id: "home", status: "scheduled" };

test("opening-week checklist is ready when schedule, roster, automation, and delivery are ready", () => {
  const result = assessOpeningWeekChecklist({ periods: [period], games: [game], activePlayerCount: 11, automationChecks: [{ label: "Line lock", passed: true }], readinessChecks: [{ id: "reminder-queue", state: "pass" }] });
  assert.equal(result.status, "ready");
  assert.equal(result.checks.find((check) => check.id === "human-check")?.state, "manual");
});

test("opening-week checklist flags missing schedule details without mutating anything", () => {
  const result = assessOpeningWeekChecklist({ periods: [period], games: [{ ...game, line_lock_at: null }], activePlayerCount: 1, automationChecks: [{ label: "Score sync", passed: false }], readinessChecks: [{ id: "reminder-queue", state: "attention", detail: "A failed reminder needs attention." }] });
  assert.equal(result.status, "attention");
  assert.equal(result.checks.find((check) => check.id === "timing")?.state, "attention");
  assert.equal(result.checks.find((check) => check.id === "roster")?.state, "attention");
  assert.equal(result.checks.find((check) => check.id === "automation")?.state, "attention");
});
