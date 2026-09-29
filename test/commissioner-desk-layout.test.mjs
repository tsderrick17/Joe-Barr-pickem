import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("the commissioner desk has no duplicate navigation or filler sections", async () => {
  const desk = await read("src/app/admin/page.tsx");
  for (const gone of ["QUICK ROUTES", "commissioner-workspace-intro", "commissioner-panel-description", "Rehearse safely, then publish", "Prepare carefully. Preserve forever."]) {
    assert.ok(!desk.includes(gone), `removed: ${gone}`);
  }
  // Readiness checks live with season work; the handbook is its own section.
  const season = desk.slice(desk.indexOf('activePanel === "season-setup"'));
  assert.match(season, /<SeasonReadiness \/>/);
  assert.match(season, /<OpeningWeekChecklist \/>/);
  const system = desk.slice(desk.indexOf('activePanel === "system"'), desk.indexOf('activePanel === "season-setup"'));
  assert.match(system, /Commissioner handbook/);
  assert.doesNotMatch(system, /<SeasonReadiness \/>|<OpeningWeekChecklist \/>/);
  assert.match(desk, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/, "the active tab stays visible on phones");
});

test("a transient profile read is retried so account controls and the Commissioner link appear", async () => {
  const nav = await read("src/components/site-nav.tsx");
  assert.match(nav, /const NAVIGATION_RETRY_DELAYS_MS = \[800, 2000, 4000\];/);
  assert.match(nav, /async function loadNavigation\(attempt = 0\)/);
  assert.match(nav, /void loadNavigation\(attempt \+ 1\)/);
  // A signed-out session still goes straight to sign-in, never retried.
  assert.ok(nav.indexOf('router.replace("/login")') < nav.indexOf("NAVIGATION_RETRY_DELAYS_MS[attempt]"));
});
