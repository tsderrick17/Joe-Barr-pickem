import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

const { loadSeasonLadder } = await import("../src/lib/season-ladder.ts");

// The polling histogram counts every fresh final recorded this season, however many score runs there were, so the runs are read in pages.
const run = (index, ladder) => ({ started_at: `2026-09-${String((index % 28) + 1).padStart(2, "0")}T12:00:00Z`, ladder });
const client = (rows, { failOnPage } = {}) => {
  const reads = [];
  const database = recordingDatabase((table, calls) => {
    const [from] = calls.find(([name]) => name === "range")[1];
    reads.push(from);
    if (failOnPage !== undefined && from === failOnPage) return { data: null, error: { code: "57014" } };
    return { data: rows.slice(from, from + 1000), error: null };
  });
  return { database, reads };
};

test("every score run of the season is counted across pages, rung by rung", async () => {
  const rows = Array.from({ length: 2_400 }, (_, index) => run(index, { 1: 1, 3: index % 2 }));
  const { database, reads } = client(rows);
  const ladder = await loadSeasonLadder(database, "2026-08-01T00:00:00Z");
  assert.deepEqual(reads, [0, 1000, 2000]);
  assert.equal(ladder.counts.get(1), 2_400);
  assert.equal(ladder.counts.get(3), 1_200);
  assert.equal(ladder.runs, 2_400);
  assert.equal(ladder.since, rows[0].started_at);
});

test("a run that found no final, or recorded something that is not a rung count, is not counted", async () => {
  const rows = [run(0, null), run(1, {}), run(2, { 2: 0, x: 4, 5: -1 }), run(3, [1, 2]), run(4, { 2: 3 })];
  const ladder = await loadSeasonLadder(client(rows).database, "2026-08-01T00:00:00Z");
  assert.deepEqual([...ladder.counts], [[2, 3]]);
  assert.equal(ladder.runs, 1);
  assert.equal(ladder.since, rows[4].started_at, "coverage starts at the first run that found a final");
});

test("an error on any page is raised, so a chart is never drawn from part of the season", async () => {
  const rows = Array.from({ length: 1_500 }, (_, index) => run(index, { 1: 1 }));
  await assert.rejects(loadSeasonLadder(client(rows, { failOnPage: 1000 }).database, "2026-08-01T00:00:00Z"), (error) => error.code === "57014");
});
