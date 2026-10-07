import assert from "node:assert/strict";
import test from "node:test";
import { authenticatePlayerPin } from "../src/lib/player-pin-authentication.js";
import { derivePlayerAuthPassword } from "../src/lib/player-auth-credential.js";

const secret = "server-secret-".padEnd(64, "x");
const user = { id: "user-1", app_metadata: { existing: true } };
const session = { access_token: "access", refresh_token: "refresh" };

test("a player signs in with only the protected Auth credential", async () => {
  const calls = [];
  const result = await authenticatePlayerPin({
    pin: "1234",
    serverSecret: secret,
    signIn: async (credentials) => {
      calls.push(credentials);
      return { data: { user, session }, error: null };
    },
  });

  assert.equal(result.auth.data.session, session);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].password, derivePlayerAuthPassword("1234", secret));
});

test("an invalid protected credential is returned for normal failure handling", async () => {
  const result = await authenticatePlayerPin({
    pin: "1234",
    serverSecret: secret,
    signIn: async () => ({ data: { user: null, session: null }, error: new Error("invalid") }),
  });

  assert.equal(result.auth.data.session, null);
  assert.ok(result.auth.error);
});
