import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeasonSnapshot } from "../src/lib/season-snapshot.js";
import { snapshotLayers, snapshotRibbons, snapshotX } from "../src/lib/season-snapshot-chart.js";

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

test("weeks share exact x positions and the current week always reaches the chart edge", () => {
  const standings = [{ id: "leader" }, { id: "runner" }, { id: "third" }];
  const weeks = [{ scores: [
    { playerId: "leader", wins: 1 }, { playerId: "runner", wins: 1 }, { playerId: "third", wins: 1 },
  ] }];
  assert.equal(snapshotX(0, 3, 700), 48);
  assert.equal(snapshotX(3, 3, 700), 682);
  assert.equal(snapshotX(18, 18, 700), 682);
  const { segments } = snapshotLayers(weeks, standings);
  assert.deepEqual(segments, [{ weekIndex: 0, from: 0, to: 1, playerIds: ["third", "runner", "leader"] }]);
});

test("playoff baseline carries final regular-season totals into the first round", () => {
  const standings = [{ id: "al" }, { id: "tyler" }];
  const weeks = [{ scores: [{ playerId: "al", wins: 21 }, { playerId: "tyler", wins: 19 }] }];
  const layers = snapshotLayers(weeks, standings, { al: 20, tyler: 19 });
  assert.deepEqual(layers.segments, [
    { weekIndex: 0, from: 20, to: 21, playerIds: ["al"] },
    { weekIndex: 0, from: 19, to: 19, playerIds: ["tyler"] },
  ]);
});

test("tied ribbons touch without overlap in standings order and join across weeks", () => {
  const standings = Array.from({ length: 11 }, (_, index) => ({ id: String(index) }));
  const weeks = [1, 2, 3].map((wins) => ({ scores: standings.map(({ id }) => ({ playerId: id, wins })) }));
  const ribbons = snapshotRibbons(weeks, standings, {}, (week) => week * 100, (wins) => 200 - wins * 40);
  for (let week = 0; week < 3; week++) {
    const bundle = ribbons.filter((ribbon) => ribbon.weekIndex === week);
    for (let index = 1; index < bundle.length; index++) {
      bundle[index].points.forEach((point, sample) => {
        assert.equal(bundle[index - 1].points[sample].bottom, point.top);
      });
    }
    assert.ok(Math.abs((bundle[0].points[2].top + bundle.at(-1).points[2].bottom) / 2 - (200 - (week + 0.82) * 40)) < 1e-9);
    if (week === 0) bundle.forEach((ribbon) => assert.deepEqual(ribbon.points[0], { x: 0, top: 200, bottom: 200 }));
    if (week > 0) bundle.forEach((ribbon) => {
      const previous = ribbons.find((entry) => entry.weekIndex === week - 1 && entry.playerId === ribbon.playerId);
      assert.deepEqual(previous.points.at(-1), ribbon.points[0]);
    });
  }
});

test("ribbons keep joined endpoints when bundles split and merge", () => {
  const standings = [{ id: "first" }, { id: "second" }, { id: "third" }];
  const weeks = [[1, 1, 1], [2, 1, 2], [3, 3, 3]].map((wins) => ({ scores: standings.map(({ id }, index) => ({ playerId: id, wins: wins[index] })) }));
  const ribbons = snapshotRibbons(weeks, standings, {}, (week) => week * 100, (wins) => 200 - wins * 40);
  for (const ribbon of ribbons.filter((entry) => entry.weekIndex > 0)) {
    const previous = ribbons.find((entry) => entry.weekIndex === ribbon.weekIndex - 1 && entry.playerId === ribbon.playerId);
    assert.deepEqual(previous.points.at(-1), ribbon.points[0]);
  }
  const first = ribbons.find((entry) => entry.weekIndex === 1 && entry.playerId === "first");
  const third = ribbons.find((entry) => entry.weekIndex === 1 && entry.playerId === "third");
  for (const sample of [1, 2, 3]) assert.equal(first.points[sample].bottom, third.points[sample].top);
});

test("snapshot is commissioner-only, previews before week six, and loads on expansion", () => {
  const route = fs.readFileSync(path.join(root, "src/app/api/admin/season-snapshot/route.ts"), "utf8");
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  assert.ok(route.indexOf("requireCommissioner(request)") < route.indexOf('supabaseAdmin.from("seasons")'));
  assert.match(scoreboard, /const showSeasonSnapshot = isCommissioner;/);
  assert.match(scoreboard, /showSeasonSnapshot \? <SeasonSnapshot/);
  assert.match(snapshot, /if \(!expanded\) return;/);
  assert.match(snapshot, /fetchSnapshot\(\)\.then/);
  assert.doesNotMatch(snapshot, />CUMULATIVE WINS<|<details className="season-snapshot-data"|season-snapshot-readout/);
  assert.doesNotMatch(snapshot, /<circle/);
  assert.match(snapshot, /regular\[1\]/);
  assert.match(snapshot, /textAnchor=\{index === weeks.length - 1 \? "end" : "middle"\}/);
  assert.doesNotMatch(snapshot, /lane =/);
  assert.doesNotMatch(snapshot, /<rect|<polyline/);
});
