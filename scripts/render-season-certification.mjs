import { appendFileSync, readFileSync } from "node:fs";

const [reportPath, summaryPath = process.env.GITHUB_STEP_SUMMARY] = process.argv.slice(2);
if (!reportPath) throw new Error("Usage: node scripts/render-season-certification.mjs <report.json> [summary.md]");

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const mark = (value) => value ? "PASS" : "FAIL";
const lines = [
  "## Full-season certification report",
  "",
  `**Overall result: ${report.status === "passed" ? "PASS" : "FAIL"}**`,
  "",
  `- Season simulated: ${report.coverage.regularSeasonWeeks} regular weeks + ${report.coverage.playoffRounds} playoff rounds`,
  `- Games reconciled: ${report.games?.total ?? "incomplete"}`,
  `- Final / cancelled / no-contest: ${report.games?.finals ?? 0} / ${report.games?.cancelled ?? 0} / ${report.games?.no_contests ?? 0}`,
  `- Playoff picks voided after day-start elimination: ${report.playoffEligibility?.picksVoided ?? 0}`,
  `- Randomized eligibility comparisons: ${report.coverage.randomizedEligibilityScenarios}`,
  `- Archived picks preserved: ${report.rollover?.archivedPicksPreserved ?? "incomplete"}`,
  "",
  "### Invariants",
  "",
  ...Object.entries(report.invariants).map(([name, passed]) => `- ${mark(passed)} — ${name}`),
  "",
  "### Chaos exercised",
  "",
  ...report.chaosEvents.map((event) => `- ${event}`),
  "",
];
if (report.failure) lines.push("### Failure", "", report.failure, "");
const markdown = `${lines.join("\n")}\n`;
if (summaryPath) appendFileSync(summaryPath, markdown);
process.stdout.write(markdown);

