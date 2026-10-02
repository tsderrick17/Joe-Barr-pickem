import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeasonSnapshot } from "../src/lib/season-snapshot.js";
import { snapshotLayers, snapshotRibbons, snapshotStackOrder, snapshotX } from "../src/lib/season-snapshot-chart.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the active week waits until its last pick settles, then plots everyone and carries totals into playoffs", () => {
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
  const regular = [
    { id: "one", label: "Week 1", complete: true, scores: [{ playerId: "al", wins: 1 }, { playerId: "tyler", wins: 0 }] },
    { id: "two", label: "Week 2", complete: true, scores: [{ playerId: "al", wins: 2 }, { playerId: "tyler", wins: 1 }] },
  ];
  // Not settled yet: nobody is plotted for the active week, even Al with a full card.
  assert.deepEqual(buildSeasonSnapshot(periods, players, picks), { regular, playoffs: [] });
  // Settled: everyone is plotted at the same time.
  assert.deepEqual(buildSeasonSnapshot(periods, players, picks, new Set(["wild"])), {
    regular,
    playoffs: [
      { id: "wild", label: "Wild Card", complete: false, scores: [{ playerId: "al", wins: 3 }, { playerId: "tyler", wins: 2 }] },
    ],
  });
});

test("an active regular week is plotted for everyone together, including a card with two losses", () => {
  const periods = [{ id: "six", display_name: "Week 6", display_order: 6, period_type: "regular", max_picks: 2, status: "active" }];
  const players = [{ id: "al" }, { id: "tyler" }];
  const picks = [
    { player_id: "al", scoring_period_id: "six", result: "loss" },
    { player_id: "al", scoring_period_id: "six", result: "loss" },
    { player_id: "tyler", scoring_period_id: "six", result: "win" },
    { player_id: "tyler", scoring_period_id: "six", result: "loss" },
  ];
  assert.deepEqual(buildSeasonSnapshot(periods, players, picks).regular, []);
  assert.deepEqual(buildSeasonSnapshot(periods, players, picks, new Set(["six"])).regular, [
    { id: "six", label: "Week 6", complete: false, scores: [{ playerId: "al", wins: 0 }, { playerId: "tyler", wins: 1 }] },
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
    // At both ends of the week the bundle is centered on the score.
    [0, 1].forEach((end) => assert.ok(Math.abs((bundle[0].points[end].top + bundle.at(-1).points[end].bottom) / 2 - (200 - (week + end) * 40)) < 1e-9));
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
  // A shared path keeps its stacking order and never overlaps along the week.
  for (const sample of [0, 1]) assert.ok(first.points[sample].bottom <= third.points[sample].top + 1e-9);
});

test("snapshot is commissioner-only, previews before week six, and loads on expansion", () => {
  const route = fs.readFileSync(path.join(root, "src/app/api/season-snapshot/route.ts"), "utf8");
  const loader = fs.readFileSync(path.join(root, "src/lib/season-snapshot-loader.ts"), "utf8");
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  // Sign-in is verified before anything is read.
  assert.ok(route.indexOf("authenticatedProfilePlayer(request)") < route.indexOf("loadSeasonSnapshot("));
  assert.match(route, /status: 401/);
  // Players are refused until Week 6; commissioners always get it.
  assert.ok(loader.includes("if (!isCommissioner && !released) return { ok: true, released, payload: null, freshForMs: CLOSED_CHART_MS };"));
  assert.match(route, /if \(!result\.payload\) return NextResponse\.json\(\{ error: "The Season Snapshot opens in Week 6\." \}, \{ status: 403 \}\);/);
  assert.ok(loader.indexOf("if (!isCommissioner && !released)") < loader.indexOf("loadPicks(visibleIds)"), "no pick data is read before the release check");
  // A cached chart is never handed to a player before the release.
  assert.match(loader, /if \(payload && \(isCommissioner \|\| released\)\) return \{ ok: true, released, payload, freshForMs \};/);
  assert.ok(scoreboard.includes("const showSeasonSnapshot = isCommissioner || seasonSnapshotReleased;"));
  assert.match(scoreboard, /showSeasonSnapshot \? <div className="pad-face pad-back"[^>]*><SeasonSnapshot active=\{flipped\}/);
  // It loads the first time the pad is turned over, not on page load.
  assert.match(snapshot, /if \(!active\) return;/);
  assert.match(snapshot, /if \(active && !opened\) \{\s*setOpened\(true\);/);
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
  const top = (playerId) => ribbons.find((ribbon) => ribbon.playerId === playerId).points[1].top;
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
  // One chart at a time: the playoff chart replaces the regular season.
  assert.doesNotMatch(snapshot, /showTitles/);
  assert.match(snapshot, /\{showPlayoffs\s*\? <SnapshotChart baseline=\{playoffBaseline\}[^\n]*\n\s*: <SnapshotChart baseline=\{\{\}\}/);
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
  // The frozen, thrice-shuffled order; a change here would recolor everyone.
  assert.deepEqual(colors.map((color) => color.toLowerCase()), ["#1baf7a", "#2a78d6", "#eb6834", "#e34948", "#00a3c4", "#e87ba4", "#eda100", "#b13fd0", "#4a3aa7", "#8ab800", "#008300"]);
  // Colors follow join order from the server, never the visible subset or rank.
  assert.match(snapshot, /const colors = snapshotColors\(standings, snapshot\.colorOrder\);/);
  assert.doesNotMatch(snapshot, /visible\.map\(\(player, index\) => \[player\.id, palette/);
  const loader = fs.readFileSync(path.join(root, "src/lib/season-snapshot-loader.ts"), "utf8");
  // One read of everyone ever added, in join order; only the plotted lines are filtered to active players.
  assert.match(loader, /from\("players"\)\.select\("id, active"\)\.order\("created_at"\)\.order\("id"\)/);
  assert.match(loader, /everyone\.filter\(\(player\) => player\.active\)/);
  assert.match(loader, /colorOrder: everyone\.map\(\(player\) => player\.id\)/);
});

test("colors never shift when someone is hidden, inactive, or new", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  // Every id in the join order keeps its slot; unknown players come after.
  assert.match(snapshot, /const known = colorOrder;/);
  assert.match(snapshot, /\[\.\.\.known, \.\.\.extras\]\.map\(\(id, index\) => \[id, palette\[index % palette\.length\]\]\)/);
});

test("the flip card turns flat, widens to the Survivor rail, and the arrows stay slim", () => {
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.doesNotMatch(scoreboard, /pad-edge/, "no slab edges");
  assert.doesNotMatch(css, /--pad-depth|\.pad-(front|back) \{[^}]*translateZ/, "no 3D thickness");
  assert.match(scoreboard, /markerEnd=/, "two arrowed half circles");
  assert.match(scoreboard, /markerUnits="userSpaceOnUse" markerWidth="5"/, "arrowheads do not scale with the stroke");
  assert.match(scoreboard, /d="M2\.2 1\.6 L7 5 L2\.2 8\.4" fill="none"/, "open chevron heads");
  assert.match(scoreboard, /strokeWidth="1\.6"/);
  assert.match(scoreboard, /setSpin\(\(current\) => current \+ 1\)/);
  assert.match(css, /\.has-pad-flip\.is-flipped \.pad-flip-inner \{ max-width: 100%; \}/);
  assert.match(css, /max-width \.7s cubic-bezier\(\.45, \.05, \.55, \.95\)/);
  // Both sides share the pad's parchment.
  assert.doesNotMatch(css, /\.has-pad-flip \.pad-back \{ background/);
  assert.match(css, /\.pad-back \{ background: var\(--ledger-paper\);/);
  assert.match(css, /transition: transform \.7s cubic-bezier\(\.45, \.05, \.55, \.95\);/);
  assert.match(css, /\.pad-face \{ transition: visibility 0s linear \.35s; \}/, "faces swap at exactly half of the .7s turn");
  assert.match(css, /\.pad-flip-icon\.is-spinning \{ animation: pad-flip-spin \.7s/);
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
  assert.match(snapshot, /className="season-snapshot-week-label">Week<\/p>/);
  assert.match(snapshot, /height: Math\.max\(100, Math\.round\(entry\.contentRect\.height\)\)/);
  assert.match(css, /\.season-snapshot-chart \{ display: flex; flex: 1 1 0; flex-direction: column; min-height: 10rem;/);
  assert.match(snapshot, /disabled=\{hidden\.size === 0\}/);
  assert.match(css, /\.season-snapshot-show-all:disabled \{/);
});

test("players see the Season Snapshot from Week 6 until the next season starts", async () => {
  const { seasonSnapshotReleased } = await import("../src/lib/season-snapshot.js");
  const week = (order, status) => ({ id: String(order), display_order: order, period_type: "regular", status });
  assert.equal(seasonSnapshotReleased([week(4, "complete"), week(5, "active"), week(6, "upcoming")]), false);
  assert.equal(seasonSnapshotReleased([week(5, "complete"), week(6, "active")]), true);
  assert.equal(seasonSnapshotReleased([{ id: "wc", display_order: 19, period_type: "playoff", status: "active" }]), true);
  // After the Aug 1 rollover every period of the new season is upcoming.
  assert.equal(seasonSnapshotReleased([week(1, "upcoming"), week(6, "upcoming")]), false);
});

test("each week is one straight band, so lines bend only at week boundaries", () => {
  const standings = players("A", "B", "C");
  // Week 1: all tied at 1. Week 2: A and C win, B does not, so the group splits.
  const weeks = weeksOf({ A: 1, B: 1, C: 1 }, { A: 2, B: 1, C: 2 }, { A: 3, B: 2, C: 2 });
  const ribbons = snapshotRibbons(weeks, standings, {}, (week) => week * 100, (wins) => 200 - wins * 40);
  // Two points per week means no interior bends, eased or otherwise.
  for (const ribbon of ribbons) {
    assert.equal(ribbon.points.length, 2);
    assert.equal(ribbon.points[0].x, ribbon.weekIndex * 100);
    assert.equal(ribbon.points[1].x, (ribbon.weekIndex + 1) * 100);
  }
});

test("All / 6 Wk toggle, a fixed y-axis, and a six-week window that notches by week", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.match(snapshot, /export const WINDOW_WEEKS = 6;/);
  assert.match(snapshot, /<h2>Season Snapshot<\/h2>\s*\{!showPlayoffs \? <div aria-label="Weeks shown" className="season-snapshot-range"/);
  assert.match(snapshot, />All<\/button>/);
  assert.match(snapshot, />6 Wk<\/button>/);
  // Every week keeps a sixth of the view; the view opens on the latest six weeks.
  assert.match(snapshot, /const step = \(viewport - PLOT_LEFT - PLOT_RIGHT\) \/ \(scrolls \? WINDOW_WEEKS : weekCount\);/);
  assert.match(snapshot, /if \(element && scrolls\) element\.scrollLeft = element\.scrollWidth;/);
  assert.match(snapshot, /className="season-snapshot-snap" key=\{index\} style=\{\{ left: index \* step \}\}/);
  assert.match(css, /scroll-snap-type: x mandatory;/);
  assert.match(css, /.season-snapshot-range {[^}]*grid-template-columns: 1fr 1fr;/, "both halves of the toggle are the same width");
  assert.match(css, /\.season-snapshot-snap \{[^}]*scroll-snap-align: start;/);
  // The y-axis sits outside the scrolling plot, with tight margins.
  assert.match(snapshot, /className="season-snapshot-yaxis"/);
  assert.match(snapshot, /const AXIS_WIDTH = 30;/);
  assert.match(snapshot, /const PLOT_BOTTOM = 18;/);
  // Not a playoff feature.
  assert.match(snapshot, /title="Regular season" weeks=\{snapshot\.regular\} windowed=\{range === "six"\}/);
});

test("chart choices are remembered, and the playoff chart starts without eliminated players", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  const scoreboard = fs.readFileSync(path.join(root, "src/components/pickem-scoreboard.tsx"), "utf8");
  assert.match(snapshot, /const RANGE_KEY = "pickem\.seasonSnapshot\.range";/);
  assert.match(snapshot, /pickem\.seasonSnapshot\.hidden\.\$\{phase\}/);
  assert.match(snapshot, /try \{ return window\.localStorage\.getItem\(key\); \} catch \{ return null; \}/);
  assert.match(snapshot, /saveSetting\(RANGE_KEY, next\);/);
  assert.match(snapshot, /saveSetting\(hiddenKey\(phase\), JSON\.stringify\(\[\.\.\.next\]\)\);/);
  // The saved range is read on first turn-over, never during the first render.
  assert.match(snapshot, /useState<Range>\("all"\)/);
  assert.match(snapshot, /setOpened\(true\);\s*setRange\(readSetting\(RANGE_KEY\) === "six" \? "six" : "all"\);/);
  // With no saved choice, playoffs default to hiding players out of the race.
  assert.match(snapshot, /return new Set\(showPlayoffs \? standings\.filter\(\(player\) => player\.eliminated\)\.map\(\(player\) => player\.id\) : \[\]\);/);
  assert.match(scoreboard, /eliminated: row\.playoffEliminated/);
  assert.match(snapshot, /key=\{showPlayoffs \? "playoffs" : "regular"\}/);
});

test("the snapshot loads fast: shared short cache, paged picks, and a saved copy for instant opens", () => {
  const loader = fs.readFileSync(path.join(root, "src/lib/season-snapshot-loader.ts"), "utf8");
  const readPages = fs.readFileSync(path.join(root, "src/lib/read-all-pages.ts"), "utf8");
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  // Freshness follows the weekly schedule instead of a fixed timer.
  const freshness = fs.readFileSync(path.join(root, "src/lib/season-snapshot-freshness.js"), "utf8");
  assert.match(freshness, /export const HOLD_MS = 60 \* 60 \* 1000;/);
  assert.match(freshness, /export const WAITING_FOR_GRADES_MS = 2 \* 60 \* 1000;/);
  assert.match(loader, /Date\.now\(\) - cached\.at < cached\.freshForMs/);
  assert.doesNotMatch(loader, /CACHE_MS = 30_000/);
  // Simultaneous opens share one load, kept apart by viewer kind so gating still holds.
  assert.match(loader, /inFlight\[kind\] \?\?= load\(isCommissioner\)/);
  // PostgREST caps responses at 1,000 rows, so picks are read in pages.
  assert.match(loader, /import \{ readAllPages \} from "@\/lib\/read-all-pages"/);
  assert.match(loader, /\.select\("player_id, scoring_period_id, game_id, result"\)\s*\.in\("scoring_period_id", periodIds\)\.order\("id"\)/);
  assert.match(readPages, /const PAGE_SIZE = 1000;/);
  assert.match(readPages, /readPage\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(readPages, /if \(\(data \?\? \[\]\)\.length < PAGE_SIZE\) return \{ data: rows, error: null \};/);
  // The device keeps the last chart so opening the back is instant; fresh data replaces it.
  assert.match(snapshot, /const SNAPSHOT_KEY = "pickem\.seasonSnapshot\.last";/);
  assert.match(snapshot, /const saved = readSavedSnapshot\(\);\s*if \(saved\) setSnapshot\(saved\);/);
  assert.match(snapshot, /saveSetting\(SNAPSHOT_KEY, JSON\.stringify\(data\)\);/);
  // An error still wins over a saved copy, so a closed or failed chart is never shown stale.
  assert.match(snapshot, /\{error \? <div className="season-snapshot-message" role="alert">/);
});

test("the week settles when the last Pick'em pick settles, usually before the final game", async () => {
  const { activeWeekState } = await import("../src/lib/season-snapshot-freshness.js");
  const HOUR = 60 * 60 * 1000;
  const sunday = Date.parse("2026-10-04T17:00:00Z");
  const mondayNight = sunday + 31 * HOUR;
  const games = [{ id: "sun1", kickoff_at: new Date(sunday).toISOString() }, { id: "sun2", kickoff_at: new Date(sunday + 3 * HOUR).toISOString() }, { id: "mnf", kickoff_at: new Date(mondayNight).toISOString() }];
  const playerIds = ["a", "b"];
  const pick = (player_id, game_id, result) => ({ player_id, game_id, result });
  const week = (now, picks, maxPicks = 2) => activeWeekState({ now, maxPicks, games, picks, playerIds });

  // Monday afternoon: nobody picked the Monday night game, every pick is graded,
  // and everyone holds both picks. The week is settled hours before the last kickoff.
  const graded = [pick("a", "sun1", "win"), pick("a", "sun2", "loss"), pick("b", "sun1", "loss"), pick("b", "sun2", "win")];
  assert.equal(week(mondayNight - 4 * HOUR, graded).settled, true);
  // A pick still pending keeps the week open.
  assert.equal(week(mondayNight - 4 * HOUR, [...graded.slice(0, 3), pick("b", "sun2", "pending")]).settled, false);
  // A player with an open pick slot could still pick Monday night, so it waits for that kickoff.
  const missing = graded.slice(0, 3);
  assert.equal(week(mondayNight - 4 * HOUR, missing).settled, false);
  assert.equal(week(mondayNight + HOUR, missing).settled, true);
  // Voided picks do not fill a slot.
  assert.equal(week(mondayNight - 4 * HOUR, [...missing, pick("b", "sun2", "void")]).settled, false);
  // A week with no games, or with an unknown pick count, is never settled early.
  assert.equal(activeWeekState({ now: mondayNight, maxPicks: 2, games: [], picks: [], playerIds }).settled, false);
  assert.equal(activeWeekState({ now: mondayNight - 4 * HOUR, maxPicks: null, games, picks: graded, playerIds }).settled, false);
  assert.equal(activeWeekState({ now: mondayNight + HOUR, maxPicks: null, games, picks: graded, playerIds }).settled, true);
});

test("the chart is held until it can change: while picks await grading, while a pick slot is open, and once settled", async () => {
  const { activeWeekState, snapshotFreshForMs } = await import("../src/lib/season-snapshot-freshness.js");
  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;
  const sunday = Date.parse("2026-10-04T17:00:00Z");
  const late = sunday + 3 * HOUR;
  const mondayNight = sunday + 31 * HOUR;
  const games = [{ id: "sun1", kickoff_at: new Date(sunday).toISOString() }, { id: "sun2", kickoff_at: new Date(late).toISOString() }, { id: "mnf", kickoff_at: new Date(mondayNight).toISOString() }];
  const playerIds = ["a"];
  const state = (now, picks, maxPicks = 2) => activeWeekState({ now, maxPicks, games, picks, playerIds });
  const pick = (game_id, result) => ({ player_id: "a", game_id, result });

  // Sunday afternoon with a pick pending on the 12:00-ish game: nothing can be graded
  // until about three hours after its kickoff, so the chart is held until then.
  const pending = state(sunday + HOUR, [pick("sun1", "pending"), pick("sun2", "pending")]);
  assert.equal(snapshotFreshForMs(sunday + HOUR, [pending]), HOUR, "capped at an hour");
  // Close to that moment it is checked at the score-sync pace.
  assert.equal(snapshotFreshForMs(late + 170 * MINUTE + MINUTE, [state(late + 170 * MINUTE + MINUTE, [pick("sun1", "win"), pick("sun2", "pending")])]), 2 * MINUTE);
  // Exactly on time, the wait is the time remaining, never less than the grade pace.
  assert.equal(snapshotFreshForMs(late + 170 * MINUTE - 30 * MINUTE, [state(late + 140 * MINUTE, [pick("sun1", "win"), pick("sun2", "pending")])]), 30 * MINUTE);
  // Everything graded but a player has an open slot: held until the last kickoff (an hour at most).
  const open = state(mondayNight - 90 * MINUTE, [pick("sun1", "win")]);
  assert.equal(snapshotFreshForMs(mondayNight - 90 * MINUTE, [open]), HOUR);
  assert.equal(snapshotFreshForMs(mondayNight - 20 * MINUTE, [state(mondayNight - 20 * MINUTE, [pick("sun1", "win")])]), 20 * MINUTE);
  // Settled: nothing is expected for a while.
  const settled = state(mondayNight - 4 * HOUR, [pick("sun1", "win"), pick("sun2", "loss")]);
  assert.equal(snapshotFreshForMs(mondayNight - 4 * HOUR, [settled]), HOUR);
  // Between weeks, with no active week, there is nothing to wait for.
  assert.equal(snapshotFreshForMs(sunday, []), HOUR);
});

test("the back of the pad loads only when shown and only when the standings changed", () => {
  const snapshot = fs.readFileSync(path.join(root, "src/components/season-snapshot.tsx"), "utf8");
  assert.match(snapshot, /const loadedFor = useRef<string \| null>\(null\);/);
  assert.match(snapshot, /const wanted = `\$\{refreshKey\}#\$\{retry\}`;\s*if \(loadedFor\.current === wanted\) return;/);
  assert.match(snapshot, /loadedFor\.current = wanted;/);
  // A newer request supersedes an older one; flipping the pad does not cancel a load.
  assert.match(snapshot, /const id = \+\+requestId\.current;/);
  assert.match(snapshot, /if \(id !== requestId\.current\) return;/);
  assert.doesNotMatch(snapshot, /setInterval/);
});
