import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedGitEnv, classifyGitHubFailure, isSafeOrigin } from "../scripts/release-git.mjs";

test("release remote rejects embedded credentials and other repositories", () => {
  assert.equal(isSafeOrigin("https://github.com/tsderrick17/Joe-Barr-pickem.git"), true);
  assert.equal(isSafeOrigin("https://x-access-token:secret@github.com/tsderrick17/Joe-Barr-pickem.git"), false);
  assert.equal(isSafeOrigin("https://github.com/tsderrick17/another-repo.git"), false);
  assert.equal(isSafeOrigin("C:\\local-repository"), false);
});

test("release diagnostics distinguish blocked network from expired authorization", () => {
  assert.equal(classifyGitHubFailure("connectex: access permissions denied"), "network");
  assert.equal(classifyGitHubFailure("HTTP 401: Bad credentials"), "login");
});

test("release Git receives a temporary header and never changes the caller environment", () => {
  const original = {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.autocrlf",
    GIT_CONFIG_VALUE_0: "false",
  };
  const env = authenticatedGitEnv("short-test-token", original, "win32");
  assert.equal(original.GIT_CONFIG_COUNT, "1");
  assert.equal(env.GIT_CONFIG_COUNT, "4");
  assert.equal(env.GIT_CONFIG_KEY_1, "credential.helper");
  assert.equal(env.GIT_CONFIG_VALUE_1, "");
  assert.equal(env.GIT_CONFIG_KEY_2, "http.sslBackend");
  assert.equal(env.GIT_CONFIG_VALUE_2, "openssl");
  assert.equal(env.GIT_CONFIG_KEY_3, "http.https://github.com/.extraheader");
  assert.equal(env.GIT_CONFIG_VALUE_3, `AUTHORIZATION: basic ${Buffer.from("x-access-token:short-test-token").toString("base64")}`);
});
