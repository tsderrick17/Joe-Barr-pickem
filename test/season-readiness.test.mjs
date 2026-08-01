import assert from "node:assert/strict";
import test from "node:test";
import { assessSeasonReadiness } from "../src/lib/season-readiness.js";

const periods = [
  { id: "week-18", display_name: "Week 18", period_type: "regular", status: "complete", max_picks: 2 },
  { id: "wild", display_name: "Wild Card", period_type: "playoff", status: "active", max_picks: 6 },
  { id: "div", display_name: "Divisional", period_type: "playoff", status: "upcoming", max_picks: 4 },
];

function game(id, periodId, status = "scheduled") {
  return { id, scoring_period_id: periodId, kickoff_at: "2027-01-10T18:00:00Z", line_lock_at: "2027-01-10T13:00:00Z", away_team_id: `${id}-away`, home_team_id: `${id}-home`, status };
}

test("season readiness accepts an active round with one pick per playable playoff game", () => {
  const games = [game("regular", "week-18", "final"), ...Array.from({ length: 6 }, (_, index) => game(`wild-${index}`, "wild")), ...Array.from({ length: 4 }, (_, index) => game(`div-${index}`, "div"))];
  const result = assessSeasonReadiness({ periods, games, reminders: [] });
  assert.equal(result.status, "ready");
  assert.equal(result.checks.find((item) => item.id === "playoff-capacity")?.state, "pass");
});

test("season readiness treats an unloaded postseason as setup, not an integrity failure", () => {
  const result = assessSeasonReadiness({
    periods: [
      { id: "regular", display_name: "Week 6", status: "active", period_type: "regular", max_picks: 2 },
    ],
    games: [game("week-6-game", "regular")],
    reminders: [],
  });

  assert.equal(result.status, "setup");
  assert.equal(result.checks.find((check) => check.id === "playoff-capacity").state, "setup");
});

test("season readiness catches capacity, timing, concurrent-period, and stalled-reminder failures", () => {
  const malformedPeriods = [...periods, { id: "duplicate", display_name: "Duplicate", period_type: "regular", status: "active", max_picks: 2 }];
  const games = [game("regular", "week-18", "live"), ...Array.from({ length: 5 }, (_, index) => game(`wild-${index}`, "wild")), { ...game("bad", "wild"), line_lock_at: "2027-01-11T19:00:00Z" }];
  const result = assessSeasonReadiness({ periods: malformedPeriods, games, reminders: [{ status: "sending", processing_started_at: "2026-01-01T00:00:00Z" }] });
  assert.equal(result.status, "attention");
  assert.equal(result.checks.find((item) => item.id === "active-period")?.state, "attention");
  assert.equal(result.checks.find((item) => item.id === "completed-periods")?.state, "attention");
  assert.equal(result.checks.find((item) => item.id === "game-timing")?.state, "attention");
  assert.equal(result.checks.find((item) => item.id === "reminder-queue")?.state, "attention");
});
