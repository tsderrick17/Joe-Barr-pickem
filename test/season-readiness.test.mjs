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

test("season readiness treats a preseason schedule with no active week as planned setup", () => {
  const result = assessSeasonReadiness({
    seasonState: "preseason",
    periods: [
      { id: "week-1", display_name: "Week 1", status: "upcoming", period_type: "regular", max_picks: 2 },
    ],
    games: [game("week-1-game", "week-1")],
    reminders: [],
  });

  assert.equal(result.status, "setup");
  assert.equal(result.checks.find((check) => check.id === "active-period")?.state, "setup");
  assert.match(result.checks.find((check) => check.id === "active-period")?.detail ?? "", /activate automatically/i);
});

test("season readiness catches completed periods whose audit history disappeared", () => {
  const result = assessSeasonReadiness({
    periods: [
      { id: "week-1", display_name: "Week 1", status: "complete", period_type: "regular", max_picks: 2 },
      { id: "week-2", display_name: "Week 2", status: "active", period_type: "regular", max_picks: 2 },
    ],
    games: [game("week-2-game", "week-2")],
    reminders: [],
  });

  assert.equal(result.status, "attention");
  assert.equal(result.checks.find((check) => check.id === "completed-period-data")?.state, "attention");
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

test("season readiness flags failed provider delivery receipts", () => {
  const result = assessSeasonReadiness({
    periods,
    games: [game("regular", "week-18", "final"), ...Array.from({ length: 6 }, (_, index) => game(`wild-${index}`, "wild")), ...Array.from({ length: 4 }, (_, index) => game(`div-${index}`, "div"))],
    reminders: [],
    emailDeliveryFailures: 2,
  });

  assert.equal(result.status, "attention");
  assert.match(result.checks.find((check) => check.id === "reminder-queue")?.detail ?? "", /2 failed email deliveries/i);
});

test("season readiness flags a gameweek pin that disagrees with its period", () => {
  const result = assessSeasonReadiness({
    periods: [{
      id: "week-1", display_name: "Week 1", status: "active",
      period_type: "regular", max_picks: 2, starts_at: "2026-09-08T04:00:00Z",
    }],
    games: [{ ...game("misfiled", "week-1"), gameweek_key: "2026-09-15" }],
    reminders: [],
  });

  assert.equal(result.status, "attention");
  assert.equal(result.checks.find((check) => check.id === "gameweek-pins")?.state, "attention");
});
