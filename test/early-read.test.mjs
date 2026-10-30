import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { earlyReadScript, sessionStorageKey, takeEarlyRead, untilAborted } from "../src/lib/early-read.js";

// The inline <head> script, run for real in a stand-in page: it starts the Standings' or the Slate's first read with
// exactly the request the page makes later, and only for a signed-in session that is not about to expire.
function runScript({ path = "/board", search = "", session = { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 3600 }, standalone = false, bowlCardShown = false } = {}) {
  const fetches = [];
  const stored = { "sb-pool-auth-token": session ? JSON.stringify(session) : null, "pickem-bowl-card-shown": bowlCardShown ? "1" : null };
  const window = {
    location: { pathname: path, search, origin: "https://pool.example" },
    localStorage: { getItem: (key) => stored[key] ?? null },
    navigator: { standalone },
    matchMedia: () => ({ matches: false }),
    fetch: (url, init) => { fetches.push({ url, init }); return Promise.resolve(new Response("{}")); },
    URLSearchParams,
    JSON,
    Date,
  };
  window.window = window;
  vm.runInNewContext(earlyReadScript("sb-pool-auth-token"), window);
  return { window, fetches };
}

test("the session key follows the Supabase client's naming", () => {
  assert.equal(sessionStorageKey("https://qtuycmgjiizrahfchsxe.supabase.co"), "sb-qtuycmgjiizrahfchsxe-auth-token");
  assert.equal(sessionStorageKey("not a url"), "sb-auth-token");
});

test("on the Slate and the Standings the first read starts at once, with the player's session", () => {
  const slate = runScript({ path: "/board" });
  assert.deepEqual(slate.fetches.map((call) => call.url), ["/api/board?bootstrap=1"]);
  assert.equal(slate.fetches[0].init.headers.Authorization, "Bearer token-1");
  assert.equal(slate.fetches[0].init.headers["X-Pickem-App"], undefined);
  assert.deepEqual(runScript({ path: "/board", search: "?week=w 7" }).fetches.map((call) => call.url), ["/api/board?bootstrap=1&week=w+7"], "the same query the page builds");
  assert.deepEqual(runScript({ path: "/" }).fetches.map((call) => call.url), ["/api/home"]);
  assert.equal(runScript({ path: "/board", standalone: true }).fetches[0].init.headers["X-Pickem-App"], "1", "the installed app says so, as the page does");
  assert.deepEqual(runScript({ path: "/", bowlCardShown: true }).fetches.map((call) => call.url), ["/api/home", "/api/bowl-pool"], "the Bowl Card's read too, when this device showed the card last time");
});

test("nothing starts on other pages, signed out, or with a session about to expire", () => {
  assert.equal(runScript({ path: "/profile" }).fetches.length, 0);
  assert.equal(runScript({ session: null }).fetches.length, 0);
  assert.equal(runScript({ session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 30 } }).fetches.length, 0);
});

test("the page takes the early answer once, only for exactly the same plain read, and only while it is fresh", async () => {
  const { window } = runScript({ path: "/board" });
  assert.equal(takeEarlyRead("/api/board?bootstrap=1&week=other", {}, window), null, "a different URL asks again");
  assert.equal(takeEarlyRead("/api/board?bootstrap=1", { method: "POST", body: "{}" }, window), null, "never a write");
  const early = takeEarlyRead("/api/board?bootstrap=1", {}, window);
  assert.ok(early instanceof Promise);
  assert.equal((await early).status, 200);
  assert.equal(takeEarlyRead("/api/board?bootstrap=1", {}, window), null, "taken once");

  const stale = runScript({ path: "/" }).window;
  assert.equal(takeEarlyRead("/api/home", {}, stale, Date.now() + 16_000), null, "an answer started more than 15 seconds ago is not used");
  assert.equal(takeEarlyRead("/api/home", {}, undefined), null, "on the server there is nothing to take");
});

test("a page that gives up on a hung early answer gets the same AbortError its own request would, and retries itself", async () => {
  const never = new Promise(() => {});
  const controller = new AbortController();
  const waiting = untilAborted(never, controller.signal);
  controller.abort();
  await assert.rejects(waiting, (error) => error.name === "AbortError");
  await assert.rejects(untilAborted(never, AbortSignal.abort()), (error) => error.name === "AbortError", "already given up");
  const answer = new Response("{}");
  assert.equal(await untilAborted(Promise.resolve(answer), new AbortController().signal), answer, "an answer in time is used");
  assert.equal(await untilAborted(Promise.resolve(answer), undefined), answer);
});
