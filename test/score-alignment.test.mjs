import assert from "node:assert/strict";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("final scores sit in fixed slots so they line up whatever the team name length", async () => {
  const css = await readStylesheet();
  assert.ok(css.includes("grid-template-columns: minmax(0, 1fr) 2.3ch 1.3em;"));
  assert.ok(!css.includes("grid-template-columns: minmax(0, max-content) 2.3ch max-content"));
  assert.match(css, /\.slate-game-row\.is-final \.slate-team-score \{ text-align: right; \}/);
});
