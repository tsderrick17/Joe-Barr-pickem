import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowSurvivorOnReceipt } from "../src/lib/survivor-receipt-visibility.js";

const base = { periodType: "regular", available: true, requiredThisPeriod: true, championCrownedAt: null, periodFirstKickoffAt: "2026-10-04T17:00:00Z" };

test("the Survivor section stays while a player is in, and through the week they are knocked out", () => {
  assert.equal(shouldShowSurvivorOnReceipt(base), true);
});

test("the week after a player is out, the receipt is the shorter Pick'em ticket", () => {
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, requiredThisPeriod: false }), false);
});

test("the playoffs and an unavailable Survivor never show the section", () => {
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, periodType: "playoff" }), false);
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, available: false }), false);
});

test("after a champion is crowned the section stays for that week, then leaves for everyone", () => {
  const crowned = "2026-12-20T03:00:00Z";
  // The week the champion is crowned in (its first kickoff came before the crowning).
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, championCrownedAt: crowned, periodFirstKickoffAt: "2026-12-18T01:00:00Z" }), true);
  // Every later week, including for the champion who is still active.
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, championCrownedAt: crowned, periodFirstKickoffAt: "2026-12-27T18:00:00Z" }), false);
  // Unknown schedule never guesses.
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, championCrownedAt: crowned, periodFirstKickoffAt: null }), false);
});

test("champion-week visibility fails closed for invalid timestamps and includes an exact kickoff boundary", () => {
  const crowned = "2026-12-18T01:00:00Z";
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, championCrownedAt: "not-a-date" }), false);
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, championCrownedAt: crowned, periodFirstKickoffAt: "not-a-date" }), false);
  assert.equal(shouldShowSurvivorOnReceipt({ ...base, championCrownedAt: crowned, periodFirstKickoffAt: crowned }), true);
});

test("the Standings ticket tears off its Survivor section for players who are out or after a champion", async () => {
  const { readFile } = await import("node:fs/promises");
  const ticket = await readFile(new URL("../src/components/my-ticket.tsx", import.meta.url), "utf8");
  // Out (from the week after their elimination week), a crowned pool, and the playoffs hide the section.
  assert.match(ticket, /const showSurvivor = !isPlayoff && survivorStatus !== "complete" && survivorRequired !== false;/);
  assert.match(ticket, /\{showSurvivor \? <div className="my-ticket-section my-ticket-survivor">/);
  // The ticket reads as one column and keeps its notes.
  assert.match(ticket, /!isPlayoff && !showSurvivor \? "is-single"/);
  assert.match(ticket, /my-ticket-section my-ticket-notes/);
});
