import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { onlyRowsWithPublicPicks, publicPickLabel, revealPickLabels } = await import("../src/lib/reveal-rows.ts");

const abbreviationById = new Map([["buf", "BUF"], ["sea", "SEA"], ["kc", "KC"]]);
const lineByGame = new Map([
  ["g1", { game_id: "g1", favorite_team_id: "buf", locked_spread: "3.5" }],
  ["g2", { game_id: "g2", favorite_team_id: "kc", locked_spread: 0 }],
  ["g3", { game_id: "g3", favorite_team_id: "sea", locked_spread: null }],
]);
const label = (gameId, selectedTeamId) => publicPickLabel({ gameId, selectedTeamId, abbreviationById, lineByGame });

test("labels read like the pad: team, then the spread from that team's side", () => {
  assert.equal(label("g1", "buf"), "BUF −3.5");
  assert.equal(label("g1", "sea"), "SEA +3.5");
  assert.equal(label("g2", "kc"), "KC PK");
  // No line record at all, never invents a number.
  assert.equal(label("g9", "sea"), "SEA · —");
  // Today's behavior, kept as is: a line row whose spread is null reads as a pick'em (Number(null) is 0).
  // Official lines are always saved with a spread, so this row shape does not occur in practice.
  assert.equal(label("g3", "sea"), "SEA PK");
  assert.equal(label("g1", "xyz"), "NFL +3.5");
});

const pick = (player, game, team, period = "w5") => ({ player_id: player, game_id: game, selected_team_id: team, scoring_period_id: period });
const picks = [pick("p1", "g1", "buf"), pick("p1", "g2", "kc"), pick("p2", "g1", "sea"), pick("p2", "g3", "sea"), pick("p3", "g1", "buf", "w4")];

test("only picks on revealed games in this period are ever included", () => {
  const labels = revealPickLabels({ picks, periodId: "w5", revealedGameIds: new Set(["g1"]), abbreviationById, lineByGame });
  assert.deepEqual([...labels.entries()], [["p1", ["BUF −3.5"]], ["p2", ["SEA +3.5"]]]);
  // g2 and g3 (not revealed) and last week's pick leave no trace.
  assert.equal(labels.has("p3"), false);
  assert.equal(JSON.stringify([...labels]).includes("KC"), false);
  // Nothing revealed, nothing shown.
  assert.equal(revealPickLabels({ picks, periodId: "w5", revealedGameIds: new Set(), abbreviationById, lineByGame }).size, 0);
});

test("the Sunday window can be limited to players who can still contend", () => {
  const labels = revealPickLabels({ picks, periodId: "w5", revealedGameIds: new Set(["g1", "g2"]), allowedPlayerIds: new Set(["p2"]), abbreviationById, lineByGame });
  assert.deepEqual([...labels.keys()], ["p2"]);
});

test("a player with no public picks is left out of the image", () => {
  const rows = [{ name: "Dana", picks: ["BUF −3.5"] }, { name: "Sam", picks: [] }];
  assert.deepEqual(onlyRowsWithPublicPicks(rows).map((row) => row.name), ["Dana"]);
});
