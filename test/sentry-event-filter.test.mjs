import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { prepareBrowserSentryEvent, prepareSentryEvent } = await import("../src/lib/sentry-event-filter.ts");

test("the one confirmed browser-extension error is dropped, however it is worded, and nothing else is", () => {
  const extension = "Invalid call to runtime.sendMessage(). Tab not found.";
  assert.equal(prepareBrowserSentryEvent({ type: undefined, message: extension }), null);
  assert.equal(prepareBrowserSentryEvent({ type: undefined, exception: { values: [{ value: `Error: ${extension}` }] } }), null, "an exception message with the Error prefix");
  const real = prepareBrowserSentryEvent({ type: undefined, message: "Cannot read properties of undefined (reading 'toLocaleString')" });
  assert.ok(real, "a real error is kept");
  assert.equal(prepareBrowserSentryEvent({ type: undefined, message: `${extension} Please retry.` })?.message, `${extension} Please retry.`, "only the exact message is dropped");
});

test("who the player is never travels with an event, and the route and surface are added without the query string", () => {
  const event = prepareSentryEvent({ type: undefined, user: { id: "p1", email: "someone@example.com" }, request: { url: "https://pickemjb.vercel.app/admin?token=secret" } });
  assert.equal(event.user, undefined);
  assert.deepEqual(event.tags, { "app.route": "/admin", "app.surface": "admin" });
  const player = prepareSentryEvent({ type: undefined, transaction: "/board" });
  assert.deepEqual(player.tags, { "app.route": "/board", "app.surface": "player" });
  assert.equal(prepareSentryEvent({ type: undefined, message: "no route known" }).tags, undefined);
});
