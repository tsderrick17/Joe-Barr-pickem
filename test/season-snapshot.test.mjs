import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeasonSnapshot } from "../src/lib/season-snapshot.js";
import { snapshotLayers, snapshotRibbons, snapshotStackOrder, snapshotX } from "../src/lib/season-snapshot-chart.js";

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
  assert.match(scoreboard, /showSeasonSnapshot \? <div className="pad-face pad-back"[^>]*><SeasonSnapshot active=\{flipped\}/);
  // It loads the first time the pad is turned over, not on page load.
  assert.match(snapshot, /if \(!opened\) return;/);
  assert.match(snapshot, /if \(active && !opened\) setOpened\(true\);/);
  assert.match(snapshot, /fetchSnapshot\(\)\.then/);
  assert.doesNotMatch(snapshot, />CUMULATIVE WINS<|<details className="season-snapshot-data"|season-snapshot-readout/);
  assert.doesNotMatch(snapshot, /<circle/);
  assert.match(snapshot, /regular\[1\]/);
  assert.match(snapshot, /textAnchor=\{index === weeks.length - 1 \? "end" : "middle"\}/);
  assert.doesNotMatch(snapshot, /lane =/);
  assert.doesNotMatch(snapshot, /<rect|<polyline/);
});

const ids = (players) => players.map((player) => player.id).join("");
const players = (...list) => list.map((id) => ({ id }));
const weeksOf = (...rows) => rows.map((row) => ({ scores: Object.entries(row).map(([playerId, wins]) => ({ playerId, wins })) }));

test("a line sits above another if it held the greater total more recently", () => {
  // B is ahead at the latest week, so B tops A even though A led earlier.
  assert.equal(ids(snapshotStackOrder(weeksOf({ A: 2, B: 0 }, { A: 2, B: 3 }), players("A", "B"))), "BA");
  // Tied now: the most recent week they differed decides (B was ahead in week 1).
  assert.equal(ids(snapshotStackOrder(weeksOf({ A: 1, B: 2 }, { A: 3, B: 3 }), players("A", "B"))), "BA");
  // The most recent difference wins over an older opposite one (A led week 1, B led week 2, tied after).
  assert.equal(ids(snapshotStackOrder(weeksOf({ A: 3, B: 1 }, { A: 3, B: 4 }, { A: 5, B: 5 }), players("A", "B"))), "BA");
  // Identical histories keep the order given (current standings).
  assert.equal(ids(snapshotStackOrder(weeksOf({ A: 1, B: 1 }), players("B", "A"))), "BA");
  // Always-tied pairs stay together while a leader separates cleanly.
  assert.equal(ids(snapshotStackOrder(weeksOf({ A: 2, B: 0, C: 1, D: 1 }, { A: 2, B: 3, C: 1, D: 1 }), players("A", "B", "C", "D"))), "BACD");
  // An unfinished card (no score this week) carries the previous total forward.
  assert.equal(ids(snapshotStackOrder([{ scores: [{ playerId: "A", wins: 2 }, { playerId: "B", wins: 1 }] }, { scores: [{ playerId: "B", wins: 2 }] }], players("A", "B"))), "AB");
  // Playoff baselines count as the starting point.
  assert.equal(ids(snapshotStackOrder(weeksOf({ A: 21, B: 21 }), players("A", "B"), { A: 19, B: 20 })), "BA");
});

test("the stacking order puts the most recent leader in the upper lane of a shared path", () => {
  const y = (wins) => 200 - wins * 40;
  const order = snapshotStackOrder(weeksOf({ A: 1, B: 2 }, { A: 3, B: 3 }), players("A", "B"));
  const ribbons = snapshotRibbons(weeksOf({ A: 3, B: 3 }), order, {}, (week) => week * 100, y);
  const top = (playerId) => ribbons.find((ribbon) => ribbon.playerId === playerId).points[2].top;
  assert.ok(top("B") < top("A"), "the player ahead most recently occupies the upper lane");
});

test("Season Snapshot shows only its title, with no explanatory prose", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  assert.match(snapshot, /<h2>Season Snapshot<\/h2>/);
  for (const prose of ["Commissioner-only", "cumulative Pick’em wins by week", "Weekly totals appear", "Season totals continue", "CURRENT STANDINGS"]) {
    assert.ok(!snapshot.includes(prose), `prose must be gone: ${prose}`);
  }
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.doesNotMatch(css, /season-snapshot-chart-note|season-snapshot-key-title|season-snapshot-heading p/);
  // A chart title only appears when two charts must be told apart.
  assert.match(snapshot, /const showTitles = showPlayoffs;/);
});

test("players can be hidden and shown, and the chart rescales to whoever remains", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  assert.match(snapshot, /const \[hidden, setHidden\] = useState<Set<string>>/);
  assert.match(snapshot, /const visible = standings\.filter\(\(player\) => !hidden\.has\(player\.id\)\);/);
  assert.match(snapshot, /players=\{visible\}/);
  // The axis is built only from visible players, so hiding the leader rescales it.
  assert.match(snapshot, /const shownIds = new Set\(players\.map\(\(player\) => player\.id\)\);/);
  assert.match(snapshot, /week\.scores\.filter\(\(score\) => shownIds\.has\(score\.playerId\)\)/);
  assert.match(snapshot, /snapshotStackOrder\(weeks, players, baseline\)/);
  assert.match(snapshot, /aria-pressed=\{shown\}/);
  assert.match(snapshot, /Show all/);
  assert.doesNotMatch(snapshot, /focusedId/);
});

test("each person keeps the same color no matter who is hidden, using eleven distinct hues", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  const colors = snapshot.match(/const palette = \[([\s\S]*?)\];/)[1].match(/#[0-9a-f]{6}/gi);
  assert.equal(colors.length, 11);
  assert.equal(new Set(colors.map((color) => color.toLowerCase())).size, 11);
  // Colors are assigned from the full alphabetical roster, never from the visible subset.
  assert.match(snapshot, /const alphabetical = \[\.\.\.standings\]\.sort/);
  assert.match(snapshot, /new Map\(alphabetical\.map/);
  assert.doesNotMatch(snapshot, /visible\.map\(\(player, index\) => \[player\.id, palette/);
});

test("motion respects reduced-motion and the key gives hidden players a visible state", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.season-snapshot-lines \{ animation: none; \}/);
  assert.match(css, /\.season-snapshot-key-row\.is-hidden/);
  assert.match(css, /\.season-snapshot-ribbon\.is-dim/);
});

test("the Season Snapshot is the back of the Pick'em Pad, turned over by a round button", () => {
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.match(scoreboard, /className="pad-flip-button"/);
  assert.match(scoreboard, /aria-pressed=\{flipped\}/);
  // Only the visible face is reachable by keyboard and screen readers.
  assert.match(scoreboard, /className="pad-face pad-front" aria-hidden=\{flipped\} inert=\{flipped\}/);
  assert.match(scoreboard, /className="pad-face pad-back" aria-hidden=\{!flipped\} inert=\{!flipped\}/);
  assert.match(css, /\.has-pad-flip\.is-flipped \.pad-flip-inner \{ transform: rotateY\(180deg\); \}/);
  assert.match(css, /backface-visibility: hidden; grid-area: 1 \/ 1;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.pad-flip-inner, \.pad-flip-button \{ transition: none; \}/);
  // Axis labels, a chart that fills the height, and a Show all that is always there.
  assert.match(snapshot, />Wins<\/text>/);
  assert.match(snapshot, />Week<\/text>/);
  assert.match(snapshot, /height: Math\.max\(180, Math\.round\(entry\.contentRect\.height\)\)/);
  assert.match(snapshot, /disabled=\{hidden\.size === 0\}/);
  assert.match(css, /\.season-snapshot-show-all:disabled \{/);
});
