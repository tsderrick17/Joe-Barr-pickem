import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedClients,
  isolatedTestConfig,
} from "./test-supabase.mjs";

const config = isolatedTestConfig();

test("isolated annual rollover creates one audited season and preserves retry continuity", { skip: !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests." }, async () => {
  const { admin } = createIsolatedClients(config);
  // Far enough ahead that this proof cannot collide with a real imported season.
  const targetYear = 4000 + Math.floor(Math.random() * 1000);
  const evaluatedAt = `${targetYear}-08-01T12:00:00.000Z`;
  let seasonId;

  try {
    const { data: firstRun, error: firstRunError } = await admin.rpc("ensure_annual_season_rollover", {
      evaluated_at: evaluatedAt,
    });
    assert.equal(firstRunError, null, firstRunError?.message);
    assert.equal(firstRun?.length, 1);
    assert.equal(firstRun[0].season_year, targetYear);
    assert.equal(firstRun[0].created, true);
    seasonId = firstRun[0].season_id;

    const { data: season, error: seasonError } = await admin
      .from("seasons")
      .select("id, year, state")
      .eq("id", seasonId)
      .single();
    assert.equal(seasonError, null, seasonError?.message);
    assert.deepEqual(season, { id: seasonId, year: targetYear, state: "preseason" });

    const { data: audit, error: auditError } = await admin
      .from("audit_logs")
      .select("action, entity_type, entity_id, details")
      .eq("action", "season_created")
      .eq("entity_id", seasonId)
      .single();
    assert.equal(auditError, null, auditError?.message);
    assert.equal(audit.action, "season_created");
    assert.equal(audit.entity_type, "season");
    assert.equal(audit.details.year, targetYear);
    assert.equal(audit.details.automatic, true);

    const { data: retryRun, error: retryRunError } = await admin.rpc("ensure_annual_season_rollover", {
      evaluated_at: evaluatedAt,
    });
    assert.equal(retryRunError, null, retryRunError?.message);
    assert.equal(retryRun?.length, 1);
    assert.equal(retryRun[0].season_id, seasonId);
    assert.equal(retryRun[0].season_year, targetYear);
    assert.equal(retryRun[0].created, false, "a retry must not create a second season or rewrite history");
  } finally {
    if (seasonId) {
      await admin.from("audit_logs").delete().eq("action", "season_created").eq("entity_id", seasonId);
      await admin.from("seasons").delete().eq("id", seasonId);
    }
  }
});
