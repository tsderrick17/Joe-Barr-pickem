import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeasonSnapshot } from "../src/lib/season-snapshot.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("snapshot adds cumulative wins only for settled periods in season order", () => {
  const periods = [
    { id: "third", display_name: "Week 3", display_order: 3, status: "active" },
    { id: "second", display_name: "Week 2", display_order: 2, status: "complete" },
    { id: "first", display_name: "Week 1", display_order: 1, status: "complete" },
  ];
  const players = [{ id: "al" }, { id: "tyler" }];
  const picks = [
    { player_id: "al", scoring_period_id: "first", result: "win" },
    { player_id: "tyler", scoring_period_id: "first", result: "loss" },
    { player_id: "al", scoring_period_id: "second", result: "pending" },
    { player_id: "tyler", scoring_period_id: "second", result: "win" },
    { player_id: "al", scoring_period_id: "third", result: "win" },
    { player_id: "retired", scoring_period_id: "second", result: "win" },
  ];

  assert.deepEqual(buildSeasonSnapshot(periods, players, picks), [
    { id: "first", label: "Week 1", scores: [{ playerId: "al", wins: 1 }, { playerId: "tyler", wins: 0 }] },
    { id: "second", label: "Week 2", scores: [{ playerId: "al", wins: 1 }, { playerId: "tyler", wins: 1 }] },
  ]);
});

test("snapshot stays unavailable to ordinary players and loads only when expanded", () => {
  const route = fs.readFileSync(path.join(root, "src/app/api/admin/season-snapshot/route.ts"), "utf8");
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");

  assert.ok(route.indexOf("requireCommissioner(request)") < route.indexOf('supabaseAdmin.from("seasons")'));
  assert.match(scoreboard, /isCommissioner\s*\?\s*<SeasonSnapshot/);
  assert.match(snapshot, /if \(!expanded && !loading\) void loadSnapshot\(\)/);
});

test("snapshot labels weeks on the horizontal axis and cumulative wins on the vertical axis", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");

  assert.match(snapshot, /SETTLED WEEK/);
  assert.match(snapshot, /CUMULATIVE WINS/);
  assert.match(snapshot, /x=\{x\(index\)\} y=\{height - 27\}/);
  assert.match(snapshot, /y1=\{y\(tick\)\} y2=\{y\(tick\)\}/);
  assert.match(css, /\.season-snapshot-layout \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 8\.65rem/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.season-snapshot-layout \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*\.season-snapshot-key \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
