import { appendFileSync } from "node:fs";
import { NFLVERSE_SCHEDULE_URL, parseNflverseGameDates } from "../src/lib/full-schedule-provider.js";
import { easternCalendarDate, selectUpgradeRehearsalDay } from "../src/lib/upgrade-rehearsal-schedule.js";

const outputPath = process.env.GITHUB_OUTPUT;
if (!outputPath) throw new Error("GITHUB_OUTPUT is required.");

const eventName = process.env.GITHUB_EVENT_NAME ?? "schedule";
const today = easternCalendarDate();
if (eventName === "workflow_dispatch") {
  appendFileSync(outputPath, `run=true\nreason=manual\nselected_date=${today}\n`);
  process.exit(0);
}

const response = await fetch(process.env.NFL_FULL_SCHEDULE_URL ?? NFLVERSE_SCHEDULE_URL, {
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`The NFL schedule feed returned HTTP ${response.status}; the rehearsal will retry on the next scheduled day.`);

const decision = selectUpgradeRehearsalDay({
  eventName,
  today,
  gameDates: parseNflverseGameDates(await response.text()),
});
appendFileSync(outputPath, `run=${decision.run}\nreason=${decision.reason}\nselected_date=${decision.date}\n`);
