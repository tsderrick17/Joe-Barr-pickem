import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Phone notifications, run for real: the endpoint checks, the service worker (loaded into a scripted browser), the key store, the sender and the
// four routes, with the database an in-memory stand-in and the push service scripted. No real notification is ever sent.
const fixture = globalThis.pushFixture = { access: { ok: true, player: { id: "p1", active: true, is_commissioner: false } }, sent: [], respond: () => ({}), keysMade: 0 };
const tables = { push_subscriptions: [], push_vapid_keys: [] };
let failNext = null;

/** A small stateful stand-in for the Supabase client: select/eq/in/maybeSingle/upsert/delete over arrays. */
function from(table) {
  const state = { op: "select", filters: [], row: null, options: {} };
  const rows = () => tables[table].filter((row) => state.filters.every(([kind, column, value]) => kind === "eq" ? row[column] === value : value.includes(row[column])));
  const run = () => {
    if (failNext === table) { failNext = null; return { data: null, error: { message: "scripted failure" } }; }
    if (state.op === "upsert") {
      const key = state.options.onConflict;
      const existing = tables[table].find((row) => row[key] === state.row[key]);
      if (existing) { if (!state.options.ignoreDuplicates) Object.assign(existing, state.row); } else tables[table].push({ id: `${table}-${tables[table].length + 1}`, ...state.row });
      return { data: null, error: null };
    }
    if (state.op === "delete") { const gone = new Set(rows()); tables[table] = tables[table].filter((row) => !gone.has(row)); return { data: null, error: null }; }
    return { data: rows(), error: null };
  };
  const builder = {
    select() { return builder; },
    eq(column, value) { state.filters.push(["eq", column, value]); return builder; },
    in(column, value) { state.filters.push(["in", column, value]); return builder; },
    upsert(row, options = {}) { Object.assign(state, { op: "upsert", row, options }); return builder; },
    delete() { state.op = "delete"; return builder; },
    maybeSingle() { const result = run(); return Promise.resolve(result.error ? result : { data: result.data[0] ?? null, error: null }); },
    then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return builder;
}
fixture.database = { from };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return { url: "data:text/javascript,export const authenticateActivePlayer = async () => globalThis.pushFixture.access;", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.pushFixture.database;", shortCircuit: true };
    if (specifier === "web-push") return { url: "data:text/javascript,export default { generateVAPIDKeys: () => { const n = ++globalThis.pushFixture.keysMade; return { publicKey: 'public-' + n, privateKey: 'private-' + n }; }, sendNotification: (...args) => globalThis.pushFixture.send(...args) };", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
fixture.send = async (...args) => { fixture.sent.push(args); const outcome = fixture.respond(args[0]); if (outcome instanceof Error) throw outcome; return outcome; };

const { isPushEndpoint, readSubscription } = await import("../src/lib/push-endpoint.js");
const { phoneNotificationStatus, applicationServerKey } = await import("../src/lib/phone-push.js");
const { vapidKeys, forgetVapidKeys } = await import("../src/lib/web-push-keys.ts");
const { sendPushToPlayer } = await import("../src/lib/player-push.ts");
const keyRoute = await import("../src/app/api/push/key/route.ts");
const subscriptionRoute = await import("../src/app/api/push/subscription/route.ts");
const testRoute = await import("../src/app/api/push/test/route.ts");

const P256DH = "B".padEnd(87, "x");
const AUTH = "a".padEnd(22, "y");
const ENDPOINT = "https://web.push.apple.com/QWERTY123";
const subscriptionBody = (endpoint = ENDPOINT) => ({ endpoint, keys: { p256dh: P256DH, auth: AUTH } });
const json = (method, body) => new Request("http://localhost/api/push/subscription", { method, headers: { "content-type": "application/json", authorization: "Bearer fixture" }, body: JSON.stringify(body) });
const reset = () => { tables.push_subscriptions = []; tables.push_vapid_keys = []; fixture.sent = []; fixture.respond = () => ({}); fixture.keysMade = 0; fixture.access = { ok: true, player: { id: "p1", active: true, is_commissioner: false } }; forgetVapidKeys(); failNext = null; };

test("only a plain https address on a real push service is accepted as a notification endpoint", () => {
  for (const good of ["https://web.push.apple.com/abc", "https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://wns2-par02p.notify.windows.com/?token=abc", "https://api.push.apple.com/3/device/abc"]) assert.equal(isPushEndpoint(good), true, good);
  for (const bad of ["http://web.push.apple.com/abc", "https://evil.example.com/abc", "https://web.push.apple.com.evil.example/abc", "https://user:pass@web.push.apple.com/abc", "https://web.push.apple.com:8443/abc", "https://127.0.0.1/abc", "https://localhost/abc", "javascript:alert(1)", "", "not a url", 42, null, undefined, `https://web.push.apple.com/${"a".repeat(1000)}`]) assert.equal(isPushEndpoint(bad), false, String(bad).slice(0, 60));
});

test("a subscription needs a good endpoint and both keys in their usual shape", () => {
  assert.deepEqual(readSubscription(subscriptionBody()), { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH });
  for (const bad of [null, "x", [], {}, { endpoint: ENDPOINT }, { endpoint: ENDPOINT, keys: null }, subscriptionBody("https://evil.example.com/x"), { endpoint: ENDPOINT, keys: { p256dh: P256DH } }, { endpoint: ENDPOINT, keys: { p256dh: "short", auth: AUTH } }, { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: "no spaces allowed here!!" } }, { endpoint: ENDPOINT, keys: { p256dh: 5, auth: AUTH } }]) assert.equal(readSubscription(bad), null, JSON.stringify(bad));
});

test("what the phone can do decides what the Notifications page says", () => {
  const status = (facts) => phoneNotificationStatus({ hasPush: true, isIPhone: false, standalone: false, permission: "default", subscribed: false, ...facts });
  assert.equal(status({ hasPush: false, isIPhone: true, standalone: false }), "not-installed", "an iPhone browser tab has no notifications: it must be added to the Home Screen");
  assert.equal(status({ hasPush: false, isIPhone: true, standalone: true }), "unsupported", "the Home Screen app without notification support cannot be helped by installing");
  assert.equal(status({ hasPush: false }), "unsupported");
  assert.equal(status({ permission: "denied" }), "blocked");
  assert.equal(status({ permission: "denied", subscribed: true }), "blocked", "a blocked phone is blocked even if an old subscription is still there");
  assert.equal(status({ permission: "granted", subscribed: true }), "on");
  assert.equal(status({ permission: "granted", subscribed: false }), "off", "allowed but not subscribed yet");
  assert.equal(status({ permission: "default" }), "off");
});

test("the server's key is read as bytes exactly as the browser needs it", () => {
  const bytes = applicationServerKey("AQID_-8"); // base64url of 01 02 03 ff ef (padding left off)
  assert.deepEqual([...bytes], [1, 2, 3, 255, 239]);
  assert.ok(bytes instanceof Uint8Array);
});

/** The service worker loaded into a scripted browser: every listener it registers, and everything it does with the browser. */
function serviceWorker({ windows = [], badge = true } = {}) {
  const listeners = {}, shown = [], badges = [], opened = [], navigated = [], focused = [];
  const self = {
    addEventListener: (name, handler) => { listeners[name] = handler; },
    registration: { showNotification: async (title, options) => { shown.push({ title, options }); } },
    navigator: badge ? { setAppBadge: async (count) => { badges.push(count); }, clearAppBadge: async () => { badges.push(0); } } : {},
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows.map((client) => ({ focus: async () => { focused.push(client.url); return client; }, navigate: async (url) => { navigated.push(url); return { focus: async () => { focused.push(url); } }; }, url: client.url })),
      openWindow: async (url) => { opened.push(url); },
    },
    location: { origin: "https://pickemjb.vercel.app" },
    skipWaiting: () => undefined,
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, URL, Promise, Number, Object });
  const fire = async (name, event) => { const waits = []; listeners[name]({ ...event, waitUntil: (promise) => waits.push(promise) }); await Promise.all(waits); };
  return { fire, shown, badges, opened, navigated, focused, listeners };
}
const pushOf = (data) => ({ data: { json: () => data, text: () => "plain words" } });

test("a push shows a notification with its words, and sets the icon badge", async () => {
  const worker = serviceWorker();
  await worker.fire("push", pushOf({ title: "Picks are due", body: "Sunday early games lock at 1:00 PM ET.", url: "/", badge: 2, tag: "pick-due" }));
  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].title, "Picks are due");
  assert.equal(worker.shown[0].options.body, "Sunday early games lock at 1:00 PM ET.");
  assert.equal(worker.shown[0].options.tag, "pick-due");
  assert.equal(worker.shown[0].options.data.url, "/");
  assert.deepEqual(worker.badges, [2]);
});

test("a badge of zero clears the icon badge, and a push without a badge leaves it alone", async () => {
  const worker = serviceWorker();
  await worker.fire("push", pushOf({ title: "All set", body: "Your picks are in.", badge: 0 }));
  assert.deepEqual(worker.badges, [0]);
  await worker.fire("push", pushOf({ title: "Recap", body: "Results are in." }));
  assert.deepEqual(worker.badges, [0], "untouched");
  for (const nonsense of [-1, 2.5, "3", null]) { const quiet = serviceWorker(); await quiet.fire("push", pushOf({ title: "x", badge: nonsense })); assert.deepEqual(quiet.badges, [], `badge ${JSON.stringify(nonsense)} is ignored`); }
});

test("a phone that cannot badge still shows the notification", async () => {
  const worker = serviceWorker({ badge: false });
  await worker.fire("push", pushOf({ title: "Picks are due", body: "x", badge: 3 }));
  assert.equal(worker.shown.length, 1);
});

test("an empty or unreadable push still shows something, and a notification can only open a page on this site", async () => {
  const worker = serviceWorker();
  await worker.fire("push", { data: null });
  await worker.fire("push", { data: { json: () => { throw new Error("not json"); }, text: () => "plain words" } });
  assert.deepEqual(worker.shown.map((item) => [item.title, item.options.body]), [["Lead Pipe Locks", ""], ["Lead Pipe Locks", "plain words"]]);
  await worker.fire("push", pushOf({ title: "Link", url: "https://evil.example.com/steal" }));
  await worker.fire("push", pushOf({ title: "Link", url: "//evil.example.com/steal" }));
  assert.equal(worker.shown[2].options.data.url, "/", "an address on another site is replaced with the home page");
  assert.equal(worker.shown[3].options.data.url, "/", "a protocol-relative address is another site too");
});

test("tapping a notification brings the open app forward at the right page, or opens it", async () => {
  const open = serviceWorker({ windows: [{ url: "https://pickemjb.vercel.app/board" }] });
  let closed = 0;
  await open.fire("notificationclick", { notification: { close: () => { closed += 1; }, data: { url: "/survivor" } } });
  assert.equal(closed, 1);
  assert.deepEqual(open.navigated, ["https://pickemjb.vercel.app/survivor"]);
  assert.deepEqual(open.focused, ["https://pickemjb.vercel.app/survivor"]);
  assert.deepEqual(open.opened, []);
  const shut = serviceWorker();
  await shut.fire("notificationclick", { notification: { close: () => undefined, data: { url: "/" } } });
  assert.deepEqual(shut.opened, ["https://pickemjb.vercel.app/"]);
  // whatever the notification carries, a tap only ever opens this site
  for (const sneaky of ["//evil.example.com/steal", "https://evil.example.com/steal", "/\evil.example.com"]) {
    const worker = serviceWorker();
    await worker.fire("notificationclick", { notification: { close: () => undefined, data: { url: sneaky } } });
    assert.equal(new URL(worker.opened[0]).origin, "https://pickemjb.vercel.app", sneaky);
  }
});

test("the service worker has no fetch handler: nothing is cached, picks and grades are always live", () => {
  const worker = serviceWorker();
  assert.deepEqual(Object.keys(worker.listeners).sort(), ["activate", "install", "notificationclick", "push"]);
});

test("the pool's notification key is made once, kept, and shared by every server instance", async () => {
  reset();
  const first = await vapidKeys();
  assert.deepEqual(first, { publicKey: "public-1", privateKey: "private-1" });
  assert.equal(tables.push_vapid_keys.length, 1);
  assert.equal(fixture.keysMade, 1);
  assert.equal(await vapidKeys(), first, "kept in memory");
  forgetVapidKeys();
  assert.deepEqual(await vapidKeys(), first, "a new instance reads what is stored instead of making another pair");
  assert.equal(fixture.keysMade, 1);
});

test("if another instance stored a key first, that one is used and ours is thrown away", async () => {
  reset();
  // The first read finds nothing, then the other instance's pair lands before ours is saved.
  const realFrom = fixture.database.from;
  let reads = 0;
  fixture.database.from = (table) => {
    const builder = realFrom(table);
    if (table !== "push_vapid_keys") return builder;
    const maybeSingle = builder.maybeSingle.bind(builder);
    builder.maybeSingle = () => { reads += 1; if (reads === 1) { tables.push_vapid_keys.push({ id: true, public_key: "winner-public", private_key: "winner-private" }); return Promise.resolve({ data: null, error: null }); } return maybeSingle(); };
    return builder;
  };
  try {
    assert.deepEqual(await vapidKeys(), { publicKey: "winner-public", privateKey: "winner-private" });
    assert.equal(tables.push_vapid_keys.length, 1, "no second row");
  } finally { fixture.database.from = realFrom; }
});

test("a key that cannot be read or saved is an error, never a made-up or half-saved pair", async () => {
  reset();
  failNext = "push_vapid_keys";
  await assert.rejects(vapidKeys(), /could not be read/);
  assert.equal(tables.push_vapid_keys.length, 0);
});

test("the key route needs a signed-in player and answers only with the public half", async () => {
  reset();
  fixture.access = { ok: false, status: 401, code: "session_invalid" };
  assert.equal((await keyRoute.GET(new Request("http://localhost/api/push/key"))).status, 401);
  assert.equal(tables.push_vapid_keys.length, 0, "nothing is made for someone who is not signed in");
  fixture.access = { ok: true, player: { id: "p1", active: true, is_commissioner: false } };
  const response = await keyRoute.GET(new Request("http://localhost/api/push/key"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { publicKey: "public-1" });
  assert.ok(!JSON.stringify(body).includes("private"));
});

test("saving a phone: a good subscription is stored for the signed-in player, saving again only refreshes it, and a bad one is refused", async () => {
  reset();
  assert.equal((await subscriptionRoute.PUT(json("PUT", subscriptionBody()))).status, 200);
  assert.equal((await subscriptionRoute.PUT(json("PUT", subscriptionBody()))).status, 200);
  assert.deepEqual(tables.push_subscriptions.map((row) => [row.player_id, row.endpoint, row.p256dh, row.auth]), [["p1", ENDPOINT, P256DH, AUTH]], "one row");
  for (const bad of [subscriptionBody("https://evil.example.com/x"), { endpoint: ENDPOINT }, []]) assert.equal((await subscriptionRoute.PUT(json("PUT", bad))).status, 400);
  assert.equal(tables.push_subscriptions.length, 1);
  fixture.access = { ok: false, status: 401, code: "session_invalid" };
  assert.equal((await subscriptionRoute.PUT(json("PUT", subscriptionBody("https://web.push.apple.com/other")))).status, 401);
  assert.equal(tables.push_subscriptions.length, 1, "a signed-out request stores nothing");
});

test("a phone that another player used before now belongs to whoever is signed in on it", async () => {
  reset();
  tables.push_subscriptions.push({ id: "old", player_id: "p2", endpoint: ENDPOINT, p256dh: "old", auth: "old" });
  await subscriptionRoute.PUT(json("PUT", subscriptionBody()));
  assert.deepEqual(tables.push_subscriptions.map((row) => [row.player_id, row.p256dh]), [["p1", P256DH]]);
});

test("a player cannot keep notifications on more than ten devices, but an existing one can still be refreshed", async () => {
  reset();
  for (let n = 0; n < 10; n += 1) await subscriptionRoute.PUT(json("PUT", subscriptionBody(`https://web.push.apple.com/device-${n}`)));
  assert.equal(tables.push_subscriptions.length, 10);
  assert.equal((await subscriptionRoute.PUT(json("PUT", subscriptionBody("https://web.push.apple.com/device-11")))).status, 409);
  assert.equal(tables.push_subscriptions.length, 10);
  assert.equal((await subscriptionRoute.PUT(json("PUT", subscriptionBody("https://web.push.apple.com/device-3")))).status, 200);
});

test("turning a phone off forgets only that phone, and only for the player asking", async () => {
  reset();
  tables.push_subscriptions.push({ id: "a", player_id: "p1", endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH }, { id: "b", player_id: "p1", endpoint: "https://web.push.apple.com/second", p256dh: P256DH, auth: AUTH }, { id: "c", player_id: "p2", endpoint: "https://web.push.apple.com/theirs", p256dh: P256DH, auth: AUTH });
  assert.equal((await subscriptionRoute.DELETE(json("DELETE", { endpoint: "https://web.push.apple.com/theirs" }))).status, 200);
  assert.equal(tables.push_subscriptions.length, 3, "another player's phone is not touched");
  assert.equal((await subscriptionRoute.DELETE(json("DELETE", { endpoint: ENDPOINT }))).status, 200);
  assert.deepEqual(tables.push_subscriptions.map((row) => row.id), ["b", "c"]);
  assert.equal((await subscriptionRoute.DELETE(json("DELETE", { endpoint: "https://evil.example.com/x" }))).status, 400);
});

test("a test notification goes to each of the player's own phones with the pool's signature, and nobody else's", async () => {
  reset();
  tables.push_subscriptions.push({ id: "a", player_id: "p1", endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH }, { id: "b", player_id: "p1", endpoint: "https://web.push.apple.com/second", p256dh: P256DH, auth: AUTH }, { id: "c", player_id: "p2", endpoint: "https://web.push.apple.com/theirs", p256dh: P256DH, auth: AUTH });
  const response = await testRoute.POST(new Request("http://localhost/api/push/test", { method: "POST" }));
  assert.deepEqual(await response.json(), { devices: 2, sent: 2, failed: 0, removed: 0 });
  assert.deepEqual(fixture.sent.map(([target]) => target.endpoint).sort(), [ENDPOINT, "https://web.push.apple.com/second"].sort());
  const [target, payload, options] = fixture.sent[0];
  assert.deepEqual(target.keys, { p256dh: P256DH, auth: AUTH });
  assert.equal(JSON.parse(payload).title, "Lead Pipe Locks");
  assert.deepEqual(options.vapidDetails, { subject: "https://pickemjb.vercel.app", publicKey: "public-1", privateKey: "private-1" });
  assert.ok(options.timeout <= 10_000 && options.TTL > 0);
  fixture.access = { ok: false, status: 401, code: "session_invalid" };
  assert.equal((await testRoute.POST(new Request("http://localhost/api/push/test", { method: "POST" }))).status, 401);
});

test("a phone the push service no longer knows is forgotten, and a temporary failure is not", async () => {
  reset();
  tables.push_subscriptions.push({ id: "gone", player_id: "p1", endpoint: "https://web.push.apple.com/gone", p256dh: P256DH, auth: AUTH }, { id: "slow", player_id: "p1", endpoint: "https://web.push.apple.com/slow", p256dh: P256DH, auth: AUTH }, { id: "fine", player_id: "p1", endpoint: "https://web.push.apple.com/fine", p256dh: P256DH, auth: AUTH });
  fixture.respond = (target) => {
    if (target.endpoint.endsWith("/gone")) return Object.assign(new Error("gone"), { statusCode: 410 });
    if (target.endpoint.endsWith("/slow")) return Object.assign(new Error("busy"), { statusCode: 503 });
    return {};
  };
  assert.deepEqual(await sendPushToPlayer("p1", { title: "x", body: "y" }), { devices: 3, sent: 1, failed: 1, removed: 1 });
  assert.deepEqual(tables.push_subscriptions.map((row) => row.id).sort(), ["fine", "slow"]);
  fixture.respond = (target) => target.endpoint.endsWith("/fine") ? Object.assign(new Error("missing"), { statusCode: 404 }) : (() => { throw new Error("network down"); })();
  assert.deepEqual(await sendPushToPlayer("p1", { title: "x", body: "y" }), { devices: 2, sent: 0, failed: 1, removed: 1 }, "an error with no status is a failure, not a removal");
  assert.deepEqual(tables.push_subscriptions.map((row) => row.id), ["slow"]);
});

test("a player with no phones registered gets an honest zero, and a database failure is an error", async () => {
  reset();
  assert.deepEqual(await sendPushToPlayer("p1", { title: "x", body: "y" }), { devices: 0, sent: 0, failed: 0, removed: 0 });
  assert.equal(fixture.sent.length, 0);
  failNext = "push_subscriptions";
  await assert.rejects(sendPushToPlayer("p1", { title: "x", body: "y" }), /devices could not be read/);
  failNext = "push_subscriptions";
  const response = await testRoute.POST(new Request("http://localhost/api/push/test", { method: "POST" }));
  assert.equal(response.status, 500);
});
