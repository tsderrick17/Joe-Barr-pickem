import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const weeklyRecap = await readFile(new URL("../src/lib/weekly-recap.ts", import.meta.url), "utf8");
const recapImage = await readFile(new URL("../src/app/api/recap-image/route.tsx", import.meta.url), "utf8");
const profile = await readFile(new URL("../src/app/profile/page.tsx", import.meta.url), "utf8");
const emailReminders = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");

test("playoff reveal snapshots are scoped to their scheduled kickoff games", () => {
  assert.match(weeklyRecap, /select\("source_game_ids"\)/);
  assert.match(weeklyRecap, /sourceIds\.has\(game\.id\)/);
  assert.match(weeklyRecap, /selectedPublicGames\.map\(\(game\) => pickByPlayerAndGame/);
  assert.match(weeklyRecap, /NO PICK — LOSS/);
});

test("large public receipts tighten and then split rather than overflow", () => {
  assert.match(recapImage, /rows\.length > 10/);
  assert.match(recapImage, /rows\.length > 16/);
  assert.match(recapImage, /Math\.ceil\(rows\.length \/ 2\)/);
});

test("Regular includes daily playoff recaps while Full Card adds every reveal", () => {
  assert.match(profile, /const regular:[^\n]+playoffDayRecap: true, playoffPublicReveal: false/);
  assert.match(profile, /const full:[^\n]+playoffDayRecap: true, playoffPublicReveal: true/);
});

test("playoff recaps explicitly memorialize eliminations and champions", () => {
  assert.match(weeklyRecap, /championsCrowned/);
  assert.match(emailReminders, /Pick'em Champion/);
  assert.match(emailReminders, /Pick'em co-champions/);
  assert.match(emailReminders, /Eliminated from Pick'em today/);
});

test("weekly Survivor recap names new eliminations and reports only entries remaining", () => {
  assert.match(emailReminders, /weeklySurvivorUpdateCopy/);
  assert.match(emailReminders, /was" : "were"\} eliminated this week/);
  assert.match(emailReminders, /entry remains" : "entries remain"/);
  assert.match(recapImage, /const survivorFooter/);
  assert.doesNotMatch(recapImage, /survivor\.in\} in · \$\{snapshot\.survivor\.out\} out/);
});
