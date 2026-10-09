import assert from "node:assert/strict";
import test from "node:test";
import "../helpers/typescript-renderer.mjs";
import { createIsolatedClients, isolatedTestConfig, testToken } from "./test-supabase.mjs";

const config = isolatedTestConfig();
const { loadSeasonLadder } = await import("../../src/lib/season-ladder.ts");

test("the grading histogram reads every recorded rung from the database, across pages, ignoring runs without one", { skip: !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests." }, async () => {
  const { admin } = createIsolatedClients(config);
  // A window far in the future cannot collide with real or other test rows.
  const year = 4500 + Math.floor(Math.random() * 450);
  const at = (minute) => new Date(Date.UTC(year, 0, 1, 0, minute)).toISOString();
  const since = new Date(Date.UTC(year, 0, 1)).toISOString();
  const until = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
  const token = testToken();
  let ids = [];

  try {
    const run = (minute, details, jobType = "scores") => ({ provider: `test-${token}`, job_type: jobType, status: "success", started_at: at(minute), completed_at: at(minute), details });
    // 1,005 runs that recorded a rung force a second page, so rows past the 1,000-row cap are counted.
    const bulk = Array.from({ length: 1005 }, (_, index) => run(index, { ladderRungs: { "1": 1, "3": index % 2 } }));
    const extras = [
      run(2000, { ladderRungs: {} }),                       // recorded no finals: not counted
      run(2001, { newFinals: 4 }),                          // an older run with no rung record at all
      run(2002, { ladderRungs: { "2": 5, "x": 9, "-1": 3 } }), // only valid rungs are counted
      run(2003, { ladderRungs: { "1": 100 } }, "line_locks"), // another worker's run is ignored
    ];
    const rows = [...bulk, ...extras];
    for (let start = 0; start < rows.length; start += 500) {
      const { data, error } = await admin.from("sync_runs").insert(rows.slice(start, start + 500)).select("id");
      assert.equal(error, null, error?.message);
      ids.push(...data.map((row) => row.id));
    }

    const ladder = await loadSeasonLadder(admin, since, until);
    assert.equal(ladder.counts.get(1), 1005, "every rung-1 final is counted, including rows past the first page");
    assert.equal(ladder.counts.get(2), 5);
    assert.equal(ladder.counts.get(3), 502, "half of the 1,005 runs recorded a rung-3 final");
    assert.equal(ladder.counts.has(-1), false);
    assert.equal(ladder.runs, 1006, "only runs that found a final on a valid rung count toward coverage");
    // The database returns its own timestamp spelling (+00:00), so compare the instant.
    assert.equal(Date.parse(ladder.since), Date.parse(at(0)), "coverage starts at the first run that found a final");
  } finally {
    for (let start = 0; start < ids.length; start += 200) {
      await admin.from("sync_runs").delete().in("id", ids.slice(start, start + 200));
    }
  }
});
