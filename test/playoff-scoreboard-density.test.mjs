import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("playoff rounds with four or more selections use the compact ledger", async () => {
  const [scoreboard, styles] = await Promise.all([
    readFile(new URL("../src/components/pickem-scoreboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(scoreboard, /const isDensePlayoffRound = isPlayoff && maxPicks >= 4;/);
  assert.match(scoreboard, /isDensePlayoffRound \? "playoff-scoreboard--dense" : ""/);
  assert.match(scoreboard, /isDensePlayoffRound \? "min-w-\[40rem\]" : "min-w-\[48rem\]"/);
  assert.match(styles, /\.playoff-scoreboard--dense \.pickem-ledger-row td \{[\s\S]*?padding-left: \.2rem;[\s\S]*?padding-right: \.2rem;/);
  assert.match(styles, /\.playoff-scoreboard--dense \.playoff-scoreboard-pick \{\s*white-space: nowrap;/);
});
