import assert from "node:assert/strict";
import test from "node:test";
import { backupProblems, copyRowCounts, REQUIRED_TABLES } from "../scripts/backup-verify.mjs";

// The weekly backup's own check: a dump with no data must fail it, and a restore that came back short must fail it.
const DUMP = [
  "SET session_replication_role = replica;",
  'COPY "public"."players" ("id", "first_name") FROM stdin;',
  "p1\tGary", "p2\tTyler\\nwith a line break", "p3\tRick",
  "\\.",
  "COPY public.seasons (id) FROM stdin;",
  "s1",
  "\\.",
  'COPY "public"."picks" ("id") FROM stdin;',
  "\\.",
  "SELECT pg_catalog.setval('public.some_seq', 5, true);",
].join("\n");

test("rows are counted per table, with or without quoted names, empty tables counted as zero, and statements outside COPY blocks ignored", () => {
  assert.deepEqual([...copyRowCounts(DUMP)], [["public.players", 3], ["public.seasons", 1], ["public.picks", 0]]);
  assert.deepEqual([...copyRowCounts("")], []);
  assert.deepEqual([...copyRowCounts('COPY "auth"."users" ("id") FROM stdin;\nu1\nu2\n\\.\n')], [["auth.users", 2]]);
});

test("a schema-only dump (what the backup used to be) fails: the tables that must have rows have none", () => {
  const problems = backupProblems({ expected: copyRowCounts(""), restored: new Map() });
  assert.deepEqual(problems.map((problem) => problem.split(":")[0]), REQUIRED_TABLES);
  assert.match(problems[0], /the backup holds no rows/);
});

test("a restore that came back short, or missing a table, is named; a matching restore passes", () => {
  const all = (rows) => new Map(REQUIRED_TABLES.map((table) => [table, rows]));
  assert.deepEqual(backupProblems({ expected: all(5), restored: all(5) }), []);
  const short = all(5); short.set("public.picks", 4); short.delete("auth.users");
  assert.deepEqual(backupProblems({ expected: all(5), restored: short }), [
    "public.picks: the backup has 5 rows, the restored copy has 4",
    "auth.users: the backup has 5 rows, the restored copy has none",
  ]);
  const extra = all(5); extra.set("public.pin_login_attempts", 0);
  assert.deepEqual(backupProblems({ expected: extra, restored: all(5) }), ["public.pin_login_attempts: the backup has 0 rows, the restored copy has none"], "an empty table that did not come back is still named");
});
