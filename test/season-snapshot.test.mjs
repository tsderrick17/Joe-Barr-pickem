import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeasonSnapshot } from "../src/lib/season-snapshot.js";
import { snapshotLayers, snapshotX } from "../src/lib/season-snapshot-chart.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("active weekly point waits for both graded picks and carries totals into playoffs", () => {
  const periods = [
    { id: "wild", display_name: "Wild Card", display_order: 19, period_type: "playoff", max_picks: 2, status: "active" },
    { id: "two", display_name: "Week 2", display_order: 2, period_type: "regular", max_picks: 2, status: "complete" },
    { id: "one", display_name: "Week 1", display_order: 1, period_type: "regular", max_picks: 2, status: "complete" },
  ];
  const players = [{ id: "al" }, { id: "tyler" }];
  const picks = [
    { player_id: "al", scoring_period_id: "one", result: "win" },
    { player_id: "al", scoring_period_id: "one", result: "loss" },
    { player_id: "tyler", scoring_period_id: "one", result: "loss" },
    { player_id: "tyler", scoring_period_id: "one", result: "loss" },
    { player_id: "al", scoring_period_id: "two", result: "win" },
    { player_id: "tyler", scoring_period_id: "two", result: "win" },
    { player_id: "al", scoring_period_id: "wild", result: "win" },
    { player_id: "al", scoring_period_id: "wild", result: "loss" },
    { player_id: "tyler", scoring_period_id: "wild", result: "win" },
  ];
  assert.deepEqual(buildSeasonSnapshot(periods, players, picks), {
    regular: [
      { id: "one", label: "Week 1", complete: true, scores: [{ playerId: "al", wins: 1 }, { playerId: "tyler", wins: 0 }] },
      { id: "two", label: "Week 2", complete: true, scores: [{ playerId: "al", wins: 2 }, { playerId: "tyler", wins: 1 }] },
    ],
    playoffs: [
      { id: "wild", label: "Wild Card", complete: false, scores: [{ playerId: "al", wins: 3 }] },
    ],
  });
});

test("an active regular week plots only fully graded cards, including two losses", () => {
  const periods = [{ id: "six", display_name: "Week 6", display_order: 6, period_type: "regular", max_picks: 2, status: "active" }];
  const players = [{ id: "al" }, { id: "tyler" }];
  const picks = [
    { player_id: "al", scoring_period_id: "six", result: "loss" },
    { player_id: "al", scoring_period_id: "six", result: "loss" },
    { player_id: "tyler", scoring_period_id: "six", result: "win" },
    { player_id: "tyler", scoring_period_id: "six", result: "pending" },
  ];
  assert.deepEqual(buildSeasonSnapshot(periods, players, picks).regular, [
    { id: "six", label: "Week 6", complete: false, scores: [{ playerId: "al", wins: 0 }] },
  ]);
});

test("all players use exact same week x, and tied colors layer in standings order", () => {
  const standings = [{ id: "leader" }, { id: "runner" }, { id: "third" }];
  const weeks = [{ scores: [
    { playerId: "leader", wins: 1 }, { playerId: "runner", wins: 1 }, { playerId: "third", wins: 1 },
  ] }];
  assert.equal(snapshotX(0), 62);
  assert.equal(snapshotX(1), 116);
  const { segments, pointGroups } = snapshotLayers(weeks, standings);
  assert.deepEqual(segments, [{ weekIndex: 0, from: 0, to: 1, playerIds: ["third", "runner", "leader"] }]);
  assert.deepEqual(pointGroups, [
    { weekIndex: 0, wins: 0, playerIds: ["third", "runner", "leader"] },
    { weekIndex: 1, wins: 1, playerIds: ["third", "runner", "leader"] },
  ]);
});

test("playoff baseline carries final regular-season totals into the first round", () => {
  const standings = [{ id: "al" }, { id: "tyler" }];
  const weeks = [{ scores: [{ playerId: "al", wins: 21 }, { playerId: "tyler", wins: 19 }] }];
  const layers = snapshotLayers(weeks, standings, { al: 20, tyler: 19 });
  assert.deepEqual(layers.segments, [
    { weekIndex: 0, from: 20, to: 21, playerIds: ["al"] },
    { weekIndex: 0, from: 19, to: 19, playerIds: ["tyler"] },
  ]);
  assert.deepEqual(layers.pointGroups.slice(0, 2), [
    { weekIndex: 0, wins: 20, playerIds: ["al"] },
    { weekIndex: 0, wins: 19, playerIds: ["tyler"] },
  ]);
});

test("snapshot is commissioner-only, hidden before week six, and loads on expansion", () => {
  const route = fs.readFileSync(path.join(root, "src/app/api/admin/season-snapshot/route.ts"), "utf8");
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  assert.ok(route.indexOf("requireCommissioner(request)") < route.indexOf('supabaseAdmin.from("seasons")'));
  assert.match(scoreboard, /isCommissioner && \(isPlayoff \|\| weekNumber >= 6\)/);
  assert.match(snapshot, /if \(!expanded\) return;/);
  assert.match(snapshot, /fetchSnapshot\(\)\.then/);
  assert.match(snapshot, /CUMULATIVE WINS/);
  assert.match(snapshot, />WEEK<\/text>/);
  assert.doesNotMatch(snapshot, /lane =/);
  assert.doesNotMatch(snapshot, /<rect|<polyline/);
});
