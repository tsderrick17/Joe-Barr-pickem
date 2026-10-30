import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

// What the Players page knows about each player: the pure wording helpers, then the activity recorder and the players route run for real
// against an in-memory stand-in for the database.
const fixture = globalThis.presenceFixture = { tables: {}, failTable: null, updates: [], upserts: [] };

/** A small stateful stand-in for the Supabase client: select/eq/gte/is/or/order, update and upsert over arrays. */
function from(table) {
  const state = { op: "select", filters: [], patch: null, upsert: null, options: {} };
  const rows = () => (fixture.tables[table] ?? []).filter((row) => state.filters.every((matches) => matches(row)));
  const run = () => {
    if (fixture.failTable === table) return { data: null, error: { code: "scripted", message: "scripted failure" } };
    if (state.op === "update") { fixture.updates.push({ table, patch: state.patch }); for (const row of rows()) Object.assign(row, state.patch); return { data: null, error: null }; }
    if (state.op === "upsert") {
      fixture.upserts.push({ table, row: state.upsert });
      const [first, second] = state.options.onConflict.split(",");
      const existing = (fixture.tables[table] ??= []).find((row) => row[first] === state.upsert[first] && row[second] === state.upsert[second]);
      if (!existing) fixture.tables[table].push({ ...state.upsert });
      return { data: null, error: null };
    }
    return { data: rows().map((row) => ({ ...row })), error: null };
  };
  const builder = {
    select() { return builder; },
    order() { return builder; },
    eq(column, value) { state.filters.push((row) => row[column] === value); return builder; },
    is(column, value) { state.filters.push((row) => row[column] === value); return builder; },
    gte(column, value) { state.filters.push((row) => row[column] >= value); return builder; },
    or(text) {
      // "last_active_at.is.null,last_active_at.lte.<time>": only the two shapes the recorder uses.
      const [, cutoff] = text.split(",")[1].split(".lte.");
      state.filters.push((row) => row.last_active_at === null || row.last_active_at === undefined || row.last_active_at <= cutoff);
      return builder;
    },
    update(patch) { Object.assign(state, { op: "update", patch }); return builder; },
    upsert(row, options = {}) { Object.assign(state, { op: "upsert", upsert: row, options }); return builder; },
    maybeSingle() { const result = run(); return Promise.resolve(result.error ? result : { data: result.data[0] ?? null, error: null }); },
    then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return builder;
}
fixture.database = { from };
fixture.access = { ok: true, player: { id: "boss", first_name: "Boss", active: true, is_commissioner: true } };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.presenceFixture.database;", shortCircuit: true };
    if (specifier === "@/lib/require-commissioner") return { url: "data:text/javascript,export const commissionerAccess = async () => globalThis.presenceFixture.access;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { describeDevice, deviceSummary, easternDay, lastSeenLabel, playerTotals, visitWindowStart, visitsLabel } = await import("../src/lib/player-presence.js");
const { activityDetails, recordPlayerActivity } = await import("../src/lib/player-activity.ts");
const playersRoute = await import("../src/app/api/admin/players/route.ts");

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1";
const IPHONE_HOME_SCREEN = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const ANDROID_SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36";
const WINDOWS_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0";
const WINDOWS_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const MAC_FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0";
const CHROMEBOOK = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.100]";

const reset = (tables = {}) => { fixture.tables = tables; fixture.failTable = null; fixture.updates = []; fixture.upserts = []; };
const request = (userAgent, viaApp = false) => ({ headers: new Headers({ "user-agent": userAgent, ...(viaApp ? { "x-pickem-app": "1" } : {}) }) });

test("a browser's User-Agent becomes a plain device and browser, and only fixed labels ever come out", () => {
  assert.deepEqual(describeDevice(IPHONE_SAFARI), { device: "iPhone", browser: "Safari" });
  assert.deepEqual(describeDevice(IPHONE_CHROME), { device: "iPhone", browser: "Chrome" });
  assert.deepEqual(describeDevice(IPHONE_HOME_SCREEN), { device: "iPhone", browser: null });
  assert.deepEqual(describeDevice(ANDROID_CHROME), { device: "Android phone", browser: "Chrome" });
  assert.deepEqual(describeDevice(ANDROID_SAMSUNG), { device: "Android phone", browser: "Samsung Internet" });
  assert.deepEqual(describeDevice(WINDOWS_EDGE), { device: "Windows computer", browser: "Edge" });
  assert.deepEqual(describeDevice(WINDOWS_CHROME), { device: "Windows computer", browser: "Chrome" });
  assert.deepEqual(describeDevice(MAC_SAFARI), { device: "Mac", browser: "Safari" });
  assert.deepEqual(describeDevice(MAC_FIREFOX), { device: "Mac", browser: "Firefox" });
  assert.deepEqual(describeDevice(CHROMEBOOK), { device: "Chromebook", browser: "Chrome" });
  assert.deepEqual(describeDevice(FACEBOOK), { device: "iPhone", browser: "Facebook app" });
  assert.deepEqual(describeDevice("curl/8.0"), { device: null, browser: null });
  assert.deepEqual(describeDevice(null), { device: null, browser: null });
});

test("where a player was last seen reads as one short line", () => {
  assert.equal(deviceSummary({ device: "iPhone", browser: "Safari", viaApp: false }), "iPhone · Safari");
  assert.equal(deviceSummary({ device: "iPhone", browser: null, viaApp: true }), "iPhone · Home Screen app");
  assert.equal(deviceSummary({ device: "Android phone", browser: "Chrome", viaApp: true }), "Android phone · Home Screen app");
  assert.equal(deviceSummary({ device: "Windows computer", browser: "Chrome", viaApp: true }), "Windows computer · installed app");
  assert.equal(deviceSummary({ device: "Mac", browser: null, viaApp: false }), "Mac");
  assert.equal(deviceSummary({ device: null, browser: null, viaApp: true }), "The app");
  assert.equal(deviceSummary({ device: null, browser: null, viaApp: false }), null);
  assert.equal(deviceSummary({ device: null, browser: null, viaApp: null }), null);
});

test("a day is an Eastern day, and the week counted is today and the six days before", () => {
  assert.equal(easternDay(Date.parse("2026-10-30T03:00:00Z")), "2026-10-29");
  assert.equal(easternDay(Date.parse("2026-10-30T05:00:00Z")), "2026-10-30");
  assert.equal(visitWindowStart(Date.parse("2026-10-30T17:00:00Z")), "2026-10-24");
  assert.equal(visitWindowStart(Date.parse("2026-11-02T17:00:00Z")), "2026-10-27");
});

test("the last-seen, week and total wording", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  const ago = (minutes) => new Date(now - minutes * 60_000).toISOString();
  assert.equal(lastSeenLabel(null, now), "Not yet signed in");
  assert.equal(lastSeenLabel(ago(0), now), "Just now");
  assert.equal(lastSeenLabel(ago(12), now), "12m ago");
  assert.equal(lastSeenLabel(ago(150), now), "2h ago");
  assert.equal(lastSeenLabel(ago(60 * 24 * 3), now), "3d ago");
  assert.equal(lastSeenLabel(ago(60 * 24 * 20), now), "Oct 10");
  assert.equal(visitsLabel(5), "5 of 7 days");
  assert.equal(visitsLabel(0), "0 of 7 days");
  assert.equal(visitsLabel(null), null);
  const players = [
    { active: true, hasApp: true, notificationsOn: true, emailNotificationsEnabled: true, visitDays: 4 },
    { active: true, hasApp: false, notificationsOn: null, emailNotificationsEnabled: true, visitDays: 0 },
    { active: false, hasApp: true, notificationsOn: true, emailNotificationsEnabled: true, visitDays: 0 },
  ];
  assert.deepEqual(playerTotals(players), { players: 2, withApp: 1, withNotifications: 1, withEmails: 2, quietThisWeek: 1 });
});

test("the request's device and the installed-app marker are read from its headers", () => {
  assert.deepEqual(activityDetails(request(IPHONE_SAFARI)), { userAgent: IPHONE_SAFARI, viaApp: false });
  assert.deepEqual(activityDetails(request(IPHONE_HOME_SCREEN, true)), { userAgent: IPHONE_HOME_SCREEN, viaApp: true });
  assert.equal(activityDetails({ headers: new Headers() }).userAgent, null);
});

test("a first visit records the time, the device and the day; a repeat the same day writes nothing more", async () => {
  reset({ players: [{ id: "visitor-1", last_active_at: null }], player_visit_days: [] });
  await recordPlayerActivity("visitor-1", activityDetails(request(IPHONE_SAFARI)));
  const [player] = fixture.tables.players;
  assert.ok(player.last_active_at);
  assert.equal(player.last_device, "iPhone");
  assert.equal(player.last_browser, "Safari");
  assert.equal(player.last_via_app, false);
  assert.equal(player.app_seen_at, undefined, "a browser tab does not make the player an app user");
  assert.deepEqual(fixture.tables.player_visit_days, [{ player_id: "visitor-1", day: easternDay(Date.now()) }]);

  const writes = fixture.updates.length + fixture.upserts.length;
  await recordPlayerActivity("visitor-1", activityDetails(request(IPHONE_SAFARI)));
  assert.equal(fixture.updates.length + fixture.upserts.length, writes, "the same visitor within the window costs no write");
});

test("opening the installed app a moment later marks the player as having it, without another time write", async () => {
  reset({ players: [{ id: "visitor-2", last_active_at: null }], player_visit_days: [] });
  await recordPlayerActivity("visitor-2", activityDetails(request(IPHONE_SAFARI)));
  const stamped = fixture.tables.players[0].last_active_at;
  await recordPlayerActivity("visitor-2", activityDetails(request(IPHONE_HOME_SCREEN, true)));
  const [player] = fixture.tables.players;
  assert.equal(player.last_active_at, stamped);
  assert.equal(player.last_via_app, true);
  assert.ok(player.app_seen_at);
  assert.equal(fixture.tables.player_visit_days.length, 1);
});

test("a visit whose first request carried no details still gets its device from the next one", async () => {
  reset({ players: [{ id: "visitor-3", last_active_at: null }], player_visit_days: [] });
  await recordPlayerActivity("visitor-3");
  assert.equal(fixture.tables.players[0].last_device, undefined);
  await recordPlayerActivity("visitor-3", activityDetails(request(WINDOWS_EDGE)));
  assert.equal(fixture.tables.players[0].last_device, "Windows computer");
  assert.equal(fixture.tables.players[0].last_browser, "Edge");
});

test("a database problem while recording a visit never throws at the player", async () => {
  reset({ players: [{ id: "visitor-4", last_active_at: null }], player_visit_days: [] });
  fixture.failTable = "players";
  const quiet = console.error;
  console.error = () => undefined;
  try { await recordPlayerActivity("visitor-4", activityDetails(request(ANDROID_CHROME))); } finally { console.error = quiet; }
  fixture.failTable = null;
  // The failed attempt is forgotten, so the next request tries again and the day is recorded then.
  await recordPlayerActivity("visitor-4", activityDetails(request(ANDROID_CHROME)));
  assert.equal(fixture.tables.players[0].last_device, "Android phone");
  assert.equal(fixture.tables.player_visit_days.length, 1);
});

const listRequest = () => new Request("http://localhost/api/admin/players");
const todayEastern = () => easternDay(Date.now());

function playersFixture() {
  return {
    players: [
      { id: "a", first_name: "Anna", login_pin: "1111", active: true, is_commissioner: false, created_at: "2026-08-01T00:00:00Z", last_active_at: "2026-10-30T10:00:00Z", notification_email: "a@example.com", email_notifications_enabled: true, last_device: "iPhone", last_browser: null, last_via_app: true, app_seen_at: "2026-10-30T10:00:00Z" },
      { id: "b", first_name: "Ben", login_pin: "2222", active: true, is_commissioner: false, created_at: "2026-08-01T00:00:00Z", last_active_at: null, notification_email: null, email_notifications_enabled: false, last_device: null, last_browser: null, last_via_app: null, app_seen_at: null },
    ],
    seasons: [{ id: "s1", year: new Date().getFullYear() }],
    pickem_forfeits: [],
    push_subscriptions: [{ player_id: "a" }],
    player_visit_days: [
      { player_id: "a", day: todayEastern() },
      { player_id: "a", day: "2020-01-01" },
    ],
  };
}

test("the Players list says who has the app and notifications, the week's visits, and where each was last seen", async () => {
  reset(playersFixture());
  const body = await (await playersRoute.GET(listRequest())).json();
  const [anna, ben] = body.players;
  assert.deepEqual([anna.hasApp, anna.notificationsOn, anna.visitDays, anna.lastSeenOn], [true, true, 1, "iPhone · Home Screen app"]);
  assert.deepEqual([ben.hasApp, ben.notificationsOn, ben.visitDays, ben.lastSeenOn], [false, false, 0, null]);
  assert.equal(anna.emailNotificationsEnabled, true);
  assert.equal(ben.emailNotificationsEnabled, false);
});

test("when the extra records cannot be read the list still loads, and says nothing instead of a wrong zero", async () => {
  reset(playersFixture());
  fixture.failTable = "push_subscriptions";
  const brokenNotifications = await (await playersRoute.GET(listRequest())).json();
  assert.equal(brokenNotifications.players[0].notificationsOn, null);
  assert.equal(brokenNotifications.players[0].visitDays, 1);

  fixture.failTable = "player_visit_days";
  const brokenVisits = await (await playersRoute.GET(listRequest())).json();
  assert.equal(brokenVisits.players[0].visitDays, null);
  assert.equal(brokenVisits.players[0].notificationsOn, true);
});
