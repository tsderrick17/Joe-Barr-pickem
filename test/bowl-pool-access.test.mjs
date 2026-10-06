import assert from "node:assert/strict";
import test from "node:test";
import { bowlPoolAccessFailure } from "../src/lib/bowl-pool-access.js";

test("Bowl Pool access preserves distinct auth, role, configuration, and outage semantics", () => {
  assert.deepEqual(bowlPoolAccessFailure({ ok: false, status: 401, code: "session_invalid" }, "view"), {
    status: 401,
    body: { error: "You must be signed in to view the Bowl Pool.", code: "session_invalid" },
  });
  assert.deepEqual(bowlPoolAccessFailure({ ok: false, status: 401, code: "session_invalid" }, "save"), {
    status: 401,
    body: { error: "You must be signed in to save Bowl Pool selections.", code: "session_invalid" },
  });
  assert.deepEqual(bowlPoolAccessFailure({ ok: false, status: 403, code: "player_inactive" }, "save"), {
    status: 403,
    body: { error: "You must be signed in as an active player to use the Bowl Pool.", code: "player_inactive" },
  });
  assert.equal(bowlPoolAccessFailure({ ok: false, status: 500, code: "auth_not_configured" }, "view").status, 500);
  assert.match(bowlPoolAccessFailure({ ok: false, status: 503, code: "profile_unavailable" }, "view").body.error, /temporarily unavailable/);
});
