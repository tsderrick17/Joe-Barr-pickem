import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

let databaseCalls = 0;
globalThis.validationDatabase = {
  from() { databaseCalls += 1; throw new Error("A rejected request must not read or write pool data."); },
  rpc() { databaseCalls += 1; throw new Error("A rejected request must not read or write pool data."); },
  auth: { admin: { getUserById() { databaseCalls += 1; throw new Error("no"); }, updateUserById() { databaseCalls += 1; throw new Error("no"); } } },
};
const person = { id: "p1", first_name: "Dana", is_commissioner: true, active: true, notification_email: null };
globalThis.validationCommissioner = async () => person;
globalThis.validationProfilePlayer = async () => person;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const stubs = {
      "@/lib/supabase-admin": "export const supabaseAdmin = globalThis.validationDatabase;",
      "@/lib/require-commissioner": "export const requireCommissioner = globalThis.validationCommissioner;",
      "@/lib/authenticated-profile-player": "export const authenticatedProfilePlayer = globalThis.validationProfilePlayer;",
    };
    if (stubs[specifier]) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";

const { readJsonObject, idValue, textValue, oneOf, integerValue, optional } = await import("../src/lib/request-validation.ts");
const bodies = await import("../src/lib/request-bodies.ts");

const json = (body) => new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body });

test("a body is an object or it is rejected: null, arrays, numbers, strings and broken JSON never reach a route", async () => {
  assert.deepEqual(await readJsonObject(json('{"a":1}')), { a: 1 });
  for (const raw of ["null", "[]", "[1]", "7", '"text"', "true", "{broken", ""]) assert.equal(await readJsonObject(json(raw)), null, raw);
});

test("field helpers accept only the right shape", () => {
  assert.equal(idValue("g1"), "g1");
  for (const bad of ["", " g1", "g1 ", "x".repeat(129), 5, null, undefined, {}, ["g1"]]) assert.equal(idValue(bad), null, String(bad));
  assert.equal(textValue("", 5), "");
  assert.equal(textValue("123456", 5), null);
  assert.equal(textValue(5, 5), null);
  assert.equal(oneOf("a", ["a", "b"]), "a");
  assert.equal(oneOf("c", ["a", "b"]), null);
  assert.equal(oneOf(["a"], ["a", "b"]), null);
  assert.equal(integerValue(5, 1, 10), 5);
  for (const bad of [0, 11, 5.5, "5", NaN, null]) assert.equal(integerValue(bad, 1, 10), null, String(bad));
  assert.deepEqual(optional(undefined, idValue), { ok: true, value: undefined });
  assert.deepEqual(optional(null, idValue), { ok: true, value: undefined });
  assert.deepEqual(optional("g1", idValue), { ok: true, value: "g1" });
  assert.deepEqual(optional(5, idValue), { ok: false });
});

test("each body parser rejects what it cannot use and keeps a legal body whole", () => {
  assert.deepEqual(bodies.parseGameDisruption({ gameId: "g1", status: "postponed" }), { gameId: "g1", status: "postponed" });
  for (const bad of [{}, { gameId: "g1" }, { gameId: "g1", status: "rescheduled" }, { gameId: 5, status: "postponed" }, { gameId: "g1", status: ["postponed"] }]) assert.equal(bodies.parseGameDisruption(bad), null);

  assert.equal(bodies.parseBowlException({ gameId: "g1", status: "rescheduled", kickoffAt: "2026-12-20T20:00:00Z", changeId: "c1" })?.changeId, "c1");
  for (const bad of [{ gameId: "g1", status: "rescheduled", kickoffAt: 5 }, { gameId: "g1", status: "rescheduled", changeId: {} }, { status: "cancelled" }, { gameId: "g1", status: "other" }]) assert.equal(bodies.parseBowlException(bad), null);

  assert.deepEqual(bodies.parseNewPlayer({ firstName: " Dana ", pin: " 1234 " }), { firstName: "Dana", pin: "1234" });
  assert.deepEqual(bodies.parseNewPlayer({ firstName: 5, pin: null }), { firstName: "", pin: "" });

  assert.equal(bodies.parseBowlSchedule({ seasonYear: 2026, csv: "a,b" })?.seasonYear, 2026);
  assert.equal(bodies.parseBowlSchedule({ seasonYear: "2026", csv: "a,b" })?.seasonYear, 2026);
  for (const bad of [{ seasonYear: 26, csv: "x" }, { seasonYear: 2026.5, csv: "x" }, { seasonYear: 2026 }, { seasonYear: 2026, csv: "" }, { seasonYear: 2026, csv: 5 }, { seasonYear: 2026, csv: "x".repeat(500_001) }]) assert.equal(bodies.parseBowlSchedule(bad), null);

  assert.deepEqual(bodies.parseTestEmail({ template: "selections" }), { selectionPreview: true });
  assert.deepEqual(bodies.parseTestEmail({ template: 5 }), { selectionPreview: false });

  assert.equal(bodies.parseChatDelete({ messageId: "m1" }), "m1");
  assert.equal(bodies.parseChatDelete({ messageId: 5 }), null);
  assert.equal(bodies.parseChatMessage({ message: "  hello   there " }), "hello there");
  assert.equal(bodies.parseChatMessage({ message: 5 }), "");
});

test("Survivor: both ids choose, neither clears, and anything in between is refused instead of clearing the pick", () => {
  assert.deepEqual(bodies.parseSurvivorSubmission({ gameId: "g1", teamId: "t1" }), { clear: false, gameId: "g1", teamId: "t1" });
  assert.deepEqual(bodies.parseSurvivorSubmission({}), { clear: true });
  assert.deepEqual(bodies.parseSurvivorSubmission({ gameId: null, teamId: null }), { clear: true });
  for (const bad of [{ gameId: "g1" }, { teamId: "t1" }, { gameId: "g1", teamId: "" }, { gameId: 5, teamId: "t1" }, { gameId: "g1", teamId: ["t1"] }, { gameId: "", teamId: "" }]) assert.equal(bodies.parseSurvivorSubmission(bad), null, JSON.stringify(bad));
});

const MALFORMED = ["null", "[]", "7", '"text"', "{broken", ""];
const requests = (method) => MALFORMED.map((raw) => [raw, new Request("http://localhost/x", { method, headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: raw })]);

const routes = [
  ["admin/bowl-pool/exceptions", "POST", [{}, { gameId: "g1" }, { gameId: "g1", status: "bogus" }, { gameId: 5, status: "cancelled" }]],
  ["admin/game-disruptions", "POST", [{}, { gameId: "g1" }, { gameId: "g1", status: "rescheduled" }, { gameId: ["g1"], status: "cancelled" }]],
  ["admin/players", "POST", [{}, { firstName: "Dana" }, { firstName: 5, pin: 1234 }, { firstName: "Dana", pin: "12" }]],
  ["admin/reminder-templates", "PUT", [{}, { id: 5 }, { id: "pick_due_sunday_11", title: "", message: "x" }]],
  ["admin/bowl-pool/schedule", "POST", [{}, { seasonYear: "x", csv: "a" }, { seasonYear: 2026 }, { csv: "a" }]],
  ["pool-chat", "POST", [{}, { message: 5 }, { message: "" }, { message: "x".repeat(281) }]],
  ["pool-chat", "DELETE", [{}, { messageId: 5 }, { messageId: "" }]],
  ["profile", "PUT", [{ showBowlCard: "yes" }]],
];

for (const [path, method, badFields] of routes) {
  test(`${method} /api/${path}: malformed and incomplete bodies get a 400 and touch no pool data`, async () => {
    const module = await import(`../src/app/api/${path}/route.ts`);
    for (const [raw, request] of requests(method)) {
      databaseCalls = 0;
      const response = await module[method](request);
      assert.equal(response.status, 400, `${path} ${raw}`);
      assert.equal(databaseCalls, 0);
    }
    for (const fields of badFields.filter((fields) => path !== "profile")) {
      databaseCalls = 0;
      const response = await module[method](new Request("http://localhost/x", { method, headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: JSON.stringify(fields) }));
      assert.equal(response.status, 400, `${path} ${JSON.stringify(fields)}`);
      assert.equal(databaseCalls, 0, `${path} ${JSON.stringify(fields)}`);
    }
  });
}

test("the test-email route treats a missing or malformed body as the plain test email, not an error", async () => {
  const source = await readFile(new URL("../src/app/api/admin/reminders/test/route.ts", import.meta.url), "utf8");
  assert.match(source, /parseTestEmail\(\(await readJsonObject\(request\)\) \?\? \{\}\)/);
});

test("the Survivor save reads and checks its body before it can touch a pick", async () => {
  const source = await readFile(new URL("../src/app/api/survivor/route.ts", import.meta.url), "utf8");
  const post = source.slice(source.indexOf("export async function POST"));
  assert.ok(post.indexOf("parseSurvivorSubmission(input)") > 0);
  assert.ok(post.indexOf("parseSurvivorSubmission(input)") < post.indexOf('.rpc("replace_unlocked_survivor_pick"'));
  assert.doesNotMatch(post, /request\.json\(\)/);
});

test("no route reads its body with a bare request.json() that a null body could break", async () => {
  const { readdir } = await import("node:fs/promises");
  const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]))).flat();
  const files = (await walk(fileURLToPath(new URL("../src/app/api", import.meta.url)))).filter((file) => file.endsWith("route.ts"));
  // Routes that read a body through the shared helpers, plus the two with their own complete checks.
  const own = new Set(["login/route.ts", "picks/route.ts", "bowl-pool/route.ts", "admin/security/player-credentials/route.ts"]);
  const offenders = [];
  for (const file of files) {
    if ([...own].some((suffix) => file.endsWith(suffix))) continue;
    if (/request\.json\(\)/.test(await readFile(file, "utf8"))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
