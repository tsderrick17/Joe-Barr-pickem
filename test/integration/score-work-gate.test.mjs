import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig } from "./test-supabase.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

// score_work_is_due, run for real. It is evaluated at a moment before any game kicked off (January 2000), so no final
// can be due; the dispatch-state rows this test writes make it true: a wake-up time the worker asked for, and the
// hourly safety run.
const evaluatedAt = "2000-01-01T12:00:00.000Z";
const minutesBefore = (minutes) => new Date(Date.parse(evaluatedAt) - minutes * 60_000).toISOString();

test("the score gate wakes the worker at the time it asked for, and at least once an hour", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const state = (row) => admin.from("automation_dispatch_state").upsert({ job_name: "scores", ...row }, { onConflict: "job_name" });
  const due = async () => {
    const { data, error } = await admin.rpc("score_work_is_due", { evaluated_at: evaluatedAt });
    assert.equal(error, null, error?.message);
    assert.equal(typeof data, "boolean");
    return data;
  };
  const { data: before } = await admin.from("automation_dispatch_state").select("*").eq("job_name", "scores").maybeSingle();
  try {
    assert.equal((await state({ last_dispatched_at: minutesBefore(10), next_due_at: minutesBefore(1) })).error, null);
    assert.equal(await due(), true, "a wake-up time that has come");

    assert.equal((await state({ last_dispatched_at: minutesBefore(120), next_due_at: null })).error, null);
    assert.equal(await due(), true, "no call for two hours: the safety run");
  } finally {
    if (before) await admin.from("automation_dispatch_state").upsert(before, { onConflict: "job_name" });
    else await admin.from("automation_dispatch_state").delete().eq("job_name", "scores");
  }
});
