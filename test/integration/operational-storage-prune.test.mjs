import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig } from "./test-supabase.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

// prune_operational_storage, run for real: old run records go, recent ones stay, and the scheduler's own run log is
// part of the weekly cleanup (it is skipped quietly where the cron schema does not exist, as in rehearsal databases).
test("the weekly cleanup removes old run records, keeps recent ones, and reports the scheduler log", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const { data: inserted, error: insertError } = await admin.from("sync_runs").insert([
    { provider: "storage-prune-probe", job_type: "odds", status: "success", started_at: daysAgo(200) },
    { provider: "storage-prune-probe", job_type: "odds", status: "success", started_at: daysAgo(2) },
  ]).select("id, started_at");
  assert.equal(insertError, null, insertError?.message);
  const [old, recent] = inserted;
  try {
    const { data, error } = await admin.rpc("prune_operational_storage", { reference_time: new Date().toISOString() });
    assert.equal(error, null, error?.message);
    const counts = new Map(data.map((row) => [row.record_type, Number(row.deleted_count)]));
    assert.deepEqual([...counts.keys()].sort(), ["cron_run_log", "resolved_automation_alerts", "resolved_schedule_change_reviews", "sync_runs"]);
    assert.ok(counts.get("sync_runs") >= 1, "the 200-day-old run was removed");
    assert.ok(counts.get("cron_run_log") >= 0);

    const { data: left, error: readError } = await admin.from("sync_runs").select("id").in("id", [old.id, recent.id]);
    assert.equal(readError, null, readError?.message);
    assert.deepEqual(left.map((row) => row.id), [recent.id], "only the recent run is kept");
  } finally {
    await admin.from("sync_runs").delete().in("id", [old.id, recent.id]);
  }
});
