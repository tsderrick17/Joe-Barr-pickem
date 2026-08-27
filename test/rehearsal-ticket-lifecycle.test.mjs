import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the player rehearsal demonstrates every important personal-ticket stage", async () => {
  const source = await readFile(new URL("../src/app/preview/page.tsx", import.meta.url), "utf8");

  assert.match(source, /import MyTicket, \{ type TicketPick \}/);
  assert.match(source, /Week 4 - fresh blank ticket/);
  assert.match(source, /Week 4 - Saturday before kickoff/);
  assert.match(source, /Week 4 - Sunday 3 PM ET/);
  assert.match(source, /Week 4 - Monday final/);
  assert.match(source, /Week 5 - safe handoff/);
  assert.match(source, /Wild Card Sunday - partial locks/);
  assert.match(source, /Final selections keep their W\/L stamps until the safe handoff/);
  assert.match(source, /<MyTicket[\s\S]*?week=\{scenario\.week\}/);
});

test("rehearsal emails visibly include representative Slate, reveal, and recap images", async () => {
  const source = await readFile(new URL("../src/app/preview/page.tsx", import.meta.url), "utf8");

  assert.match(source, /emailImage: "slate"/);
  assert.match(source, /emailImage: "reveal"/);
  assert.match(source, /emailImage: "recap"/);
  assert.match(source, /function EmailSampleImage/);
  assert.match(source, /Sample Slate image included in this email/);
  assert.match(source, /FINAL W\/L STAMPS REMAIN MEMORIALIZED/);
  assert.match(source, /pick\.resultMark === "win" \? " W" : pick\.resultMark === "loss" \? " L"/);
  assert.match(source, /<EmailSampleImage rows=\{rows\} scenario=\{scenario\}/);
});
