import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8");

test("Bowl standings expose pre-kickoff markers only to the commissioner or picking player", () => {
  assert.match(route, /new Date\(game\.kickoff_at\) > now && \(player\.is_commissioner \|\| entry\?\.player_id === player\.id\)/);
});
