import assert from "node:assert/strict";
import test from "node:test";
import { isolatedDatabaseEnabled, isolatedDatabaseUrl } from "./test-database.mjs";

const safeEnv = {
  PICKEM_TEST_DATABASE_CONFIRMATION: "isolated",
  PICKEM_TEST_DATABASE_URL: "postgresql://postgres:secret@db.disposable-project.supabase.co:5432/postgres",
};

test("isolated database gate stays disabled until the exact confirmation and URL are present", () => {
  assert.equal(isolatedDatabaseUrl({}), undefined);
  assert.equal(isolatedDatabaseUrl({ ...safeEnv, PICKEM_TEST_DATABASE_CONFIRMATION: "yes" }), undefined);
  assert.equal(isolatedDatabaseEnabled({ env: safeEnv }), true);
  assert.equal(isolatedDatabaseEnabled({ env: safeEnv, flagName: "PICKEM_WEEKLY_REHEARSAL", flagValue: "true" }), false);
});

test("isolated database gate rejects production even when isolated confirmation is set", () => {
  const productionEnv = {
    ...safeEnv,
    PICKEM_TEST_DATABASE_URL: "postgresql://postgres.qtuycmgjiizrahfchsxe:secret@pooler.supabase.com:5432/postgres",
  };
  assert.throws(() => isolatedDatabaseUrl(productionEnv), /production database/);
  assert.throws(() => isolatedDatabaseEnabled({ env: productionEnv }), /production database/);
});

test("isolated database gate rejects malformed and non-PostgreSQL connection URLs", () => {
  assert.throws(() => isolatedDatabaseUrl({ ...safeEnv, PICKEM_TEST_DATABASE_URL: "not a url" }), /valid PostgreSQL/);
  assert.throws(() => isolatedDatabaseUrl({ ...safeEnv, PICKEM_TEST_DATABASE_URL: "https://test.supabase.co" }), /PostgreSQL protocol/);
});
