import assert from "node:assert/strict";
import test from "node:test";
import {
  derivePlayerAuthPassword,
  legacyPlayerAuthPassword,
  PLAYER_AUTH_CREDENTIAL_VERSION,
  playerAuthEmail,
} from "../src/lib/player-auth-credential.js";

test("player Auth credentials are deterministic, strong, and not the PIN", () => {
  const secret = "s".repeat(64);
  const first = derivePlayerAuthPassword("1234", secret);
  const same = derivePlayerAuthPassword("1234", secret);
  const otherPin = derivePlayerAuthPassword("1235", secret);
  const otherSecret = derivePlayerAuthPassword("1234", "t".repeat(64));

  assert.equal(first, same);
  assert.notEqual(first, otherPin);
  assert.notEqual(first, otherSecret);
  assert.equal(first.includes("1234"), false);
  assert.ok(first.length >= 40);
  assert.equal(playerAuthEmail("1234"), "pin-1234@pickemjb.app");
  assert.equal(legacyPlayerAuthPassword("1234"), "pickem-1234");
  assert.equal(PLAYER_AUTH_CREDENTIAL_VERSION, 2);
});

test("player Auth credential derivation rejects malformed PINs and weak secrets", () => {
  assert.throws(() => derivePlayerAuthPassword("123", "s".repeat(64)), /four-digit PIN/);
  assert.throws(() => derivePlayerAuthPassword("1234", "short"), /strong server credential/);
});
