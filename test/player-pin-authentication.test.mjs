import assert from "node:assert/strict";
import test from "node:test";
import { authenticatePlayerPin } from "../src/lib/player-pin-authentication.js";
import { derivePlayerAuthPassword, legacyPlayerAuthPassword } from "../src/lib/player-auth-credential.js";

const secret = "server-secret-".padEnd(64, "x");
const user = { id: "user-1", app_metadata: { existing: true } };
const session = { access_token: "access", refresh_token: "refresh" };

test("a hardened player signs in without trying the legacy credential", async () => {
  const calls = [];
  const result = await authenticatePlayerPin({
    pin: "1234",
    serverSecret: secret,
    signIn: async (credentials) => {
      calls.push(credentials);
      return { data: { user, session }, error: null };
    },
    updateAccount: async () => { throw new Error("must not rotate"); },
  });

  assert.equal(result.auth.data.session, session);
  assert.equal(result.migrated, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].password, derivePlayerAuthPassword("1234", secret));
});

test("a legacy player is rotated before a hardened session is returned", async () => {
  const passwords = [];
  const updates = [];
  const hardened = derivePlayerAuthPassword("1234", secret);
  const result = await authenticatePlayerPin({
    pin: "1234",
    serverSecret: secret,
    signIn: async ({ password }) => {
      passwords.push(password);
      if (password === legacyPlayerAuthPassword("1234")) {
        return { data: { user, session }, error: null };
      }
      if (password === hardened && passwords.length > 2) {
        return { data: { user, session }, error: null };
      }
      return { data: { user: null, session: null }, error: new Error("invalid") };
    },
    updateAccount: async (userId, attributes) => {
      updates.push({ userId, attributes });
      return { error: null };
    },
  });

  assert.deepEqual(passwords, [hardened, legacyPlayerAuthPassword("1234"), hardened]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].userId, "user-1");
  assert.equal(updates[0].attributes.password, hardened);
  assert.deepEqual(updates[0].attributes.app_metadata, { existing: true, pickem_credential_version: 2 });
  assert.equal(result.migrated, true);
  assert.equal(result.rotationFailed, false);
});

test("a failed rotation never returns the weak legacy session", async () => {
  let call = 0;
  const result = await authenticatePlayerPin({
    pin: "1234",
    serverSecret: secret,
    signIn: async () => {
      call += 1;
      return call === 1
        ? { data: { user: null, session: null }, error: new Error("invalid") }
        : { data: { user, session }, error: null };
    },
    updateAccount: async () => ({ error: new Error("unavailable") }),
  });

  assert.equal(result.rotationFailed, true);
  assert.equal(result.migrated, false);
});
