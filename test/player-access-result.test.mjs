import assert from "node:assert/strict";
import test from "node:test";
import { resolvePlayerAccess } from "../src/lib/player-access-result.js";

const commissioner = { id: "player-1", active: true, is_commissioner: true };
const ordinary = { ...commissioner, is_commissioner: false };

function request(overrides = {}) {
  const calls = [];
  return {
    calls,
    options: {
      authorization: "Bearer valid-token",
      configured: true,
      verifyToken: async (token) => { calls.push(["verify", token]); return { data: { user: { id: "auth-1" } }, error: null }; },
      loadPlayer: async (id) => { calls.push(["profile", id]); return { data: commissioner, error: null }; },
      ...overrides,
    },
  };
}

test("missing configuration and malformed sessions do not read a profile", async () => {
  for (const authorization of [null, "", "Bearer", "Bearer ", "Basic token", "Bearer two words"]) {
    const { options, calls } = request({ authorization });
    assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 401, code: "session_invalid" });
    assert.deepEqual(calls, []);
  }
  const { options, calls } = request({ configured: false });
  assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 500, code: "auth_not_configured" });
  assert.deepEqual(calls, []);
});

test("expired token is distinct from an authentication service outage", async () => {
  for (const status of [400, 401, 403]) {
    const { options, calls } = request({ verifyToken: async () => ({ data: { user: null }, error: { status } }) });
    assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 401, code: "session_invalid" });
    assert.deepEqual(calls, []);
  }
  for (const error of [{ status: 503 }, { status: 0 }, { status: 429 }, { status: undefined }]) {
    const { options } = request({ verifyToken: async () => ({ data: { user: null }, error }) });
    assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 503, code: "auth_unavailable" });
  }
  const { options } = request({ verifyToken: async () => { throw new Error("network"); } });
  assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 503, code: "auth_unavailable" });
});

test("profile failures are not mistaken for invalid sessions or inactive players", async () => {
  for (const loadPlayer of [
    async () => ({ data: null, error: { message: "database unavailable" } }),
    async () => { throw new Error("network"); },
  ]) {
    const { options, calls } = request({ loadPlayer });
    assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 503, code: "profile_unavailable" });
    assert.deepEqual(calls, [["verify", "valid-token"]]);
  }
  const { options } = request({ loadPlayer: async () => ({ data: null, error: null }) });
  assert.deepEqual(await resolvePlayerAccess(options), { ok: false, status: 403, code: "player_not_found" });
  const inactiveRequest = request({ loadPlayer: async () => ({ data: { ...ordinary, active: false }, error: null }) });
  assert.deepEqual(await resolvePlayerAccess(inactiveRequest.options), { ok: false, status: 403, code: "player_inactive" });
});

test("active player passes; commissioner-only access has a distinct denial", async () => {
  const { options, calls } = request();
  assert.deepEqual(await resolvePlayerAccess(options), { ok: true, player: commissioner });
  assert.deepEqual(calls, [["verify", "valid-token"], ["profile", "auth-1"]]);
  const ordinaryRequest = request({ requireCommissioner: true, loadPlayer: async () => ({ data: ordinary, error: null }) });
  assert.deepEqual(await resolvePlayerAccess(ordinaryRequest.options), { ok: false, status: 403, code: "commissioner_required" });
  assert.deepEqual(await resolvePlayerAccess(request({ requireCommissioner: true }).options), { ok: true, player: commissioner });
});
