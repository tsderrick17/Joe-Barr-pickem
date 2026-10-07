import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach, after } from "node:test";

const commissioner = { id: "player-1", first_name: "Fixture", active: true, is_commissioner: true };
const state = {};
globalThis.commissionerAuthState = state;
function reset() {
  Object.assign(state, {
    verified: { data: { user: { id: "auth-1" } }, error: null },
    profile: { data: commissioner, error: null },
    profileQueue: [], authCalls: [], profileCalls: [], workCalls: [],
    serviceArguments: [], serviceResults: {}, leaseError: null,
    leaseSignal: new AbortController().signal, rpcCalls: [], rpcResult: { data: [], error: null },
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
  process.env.SUPABASE_SECRET_KEY = "fixture-server-key";
  process.env.ODDS_API_KEY = "fixture-provider-key";
  process.env.CRON_SECRET = "fixture-cron-secret";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}
beforeEach(reset);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { state.workCalls.push("fetch"); throw new Error("No network in route access tests"); };
after(() => { globalThis.fetch = originalFetch; });

globalThis.commissionerAuthClient = {
  auth: {
    async getUser(token) {
      state.authCalls.push(token);
      if (state.verified instanceof Error) throw state.verified;
      return state.verified;
    },
  },
};
globalThis.commissionerAuthDatabase = {
  async rpc(name, args) {
    state.workCalls.push(name);
    state.rpcCalls.push([name, args]);
    return state.rpcResult;
  },
  from(table) {
    const query = {
      select(columns) {
        if (table !== "players" || columns !== "id, first_name, active, is_commissioner") {
          state.workCalls.push(table);
          throw new Error("Protected data must not be read before authorization");
        }
        return query;
      },
      eq(column, value) {
        assert.equal(column, "auth_user_id");
        assert.equal(value, "auth-1");
        return query;
      },
      async maybeSingle() {
        state.profileCalls.push(table);
        const result = state.profileQueue.shift() ?? state.profile;
        if (result instanceof Error) throw result;
        return result;
      },
      insert() { state.workCalls.push(`insert:${table}`); throw new Error("Unexpected write"); },
      update() { state.workCalls.push(`update:${table}`); throw new Error("Unexpected write"); },
      upsert() { state.workCalls.push(`upsert:${table}`); throw new Error("Unexpected write"); },
      delete() { state.workCalls.push(`delete:${table}`); throw new Error("Unexpected write"); },
    };
    return query;
  },
};
globalThis.commissionerTestService = (name, ...args) => {
  state.workCalls.push(name);
  state.serviceArguments.push([name, args]);
  return state.serviceResults[name] ?? (name === "accounts" || name === "storage" ? [] : { status: "healthy" });
};
globalThis.commissionerTestLease = async (job, task, withContext) => {
  state.workCalls.push(`lease:${job}`);
  if (state.leaseError) throw state.leaseError;
  return withContext ? task({ signal: state.leaseSignal }) : task();
};

const services = (names) => names.map((name) => `export const ${name} = async (...args) => globalThis.commissionerTestService('${name}', ...args);`).join("\n");

const serviceModules = {
  "@/lib/account-capacity": 'export const loadAccountCapacity = async () => globalThis.commissionerTestService("accounts"); export const loadStorageTableUsage = async () => globalThis.commissionerTestService("storage");',
  "@/lib/automation-health": 'export const checkAutomationHealth = async () => globalThis.commissionerTestService("health");',
  "@/lib/watchdog-status": 'export const getWatchdogStatus = async () => globalThis.commissionerTestService("watchdog");',
  "@/lib/launch-preflight": 'export const runLaunchPreflight = async () => globalThis.commissionerTestService("preflight");',
  "@/lib/season-ladder": 'export const loadSeasonLadder = async () => globalThis.commissionerTestService("ladder");',
  "@/lib/score-check-backoff": "export const SCORE_POLLING_RETRY_MINUTES = [];",
  "@/lib/automation-execution-lease": "export class AutomationAlreadyRunningError extends Error {} export const runWithAutomationLease = (job, task) => globalThis.commissionerTestLease(job, task, false); export const runWithAutomationLeaseContext = (job, task) => globalThis.commissionerTestLease(job, task, true);",
  "@/lib/lock-due-lines": services(["lockDueLines"]),
  "@/lib/sync-final-scores": services(["syncFinalScores"]),
  "@/lib/full-schedule-bootstrap": services(["bootstrapFullSchedule", "prepareFullSchedule", "getSeasonBootstrapStatus"]),
  "@/lib/full-schedule-reconciliation": services(["reconcileFullSeasonSchedule"]),
  "@/lib/schedule-provider-circuit": services(["clearScheduleProviderCircuit", "getScheduleProviderCircuit", "recordScheduleProviderFailure"]),
  "@/lib/automation-watchdog": services(["getWatchdogStatus", "runAutomationWatchdog"]),
  "@/lib/email-reminders": services(["deliverEmailTest", "messageHtml"]),
  "@/lib/email-artwork": services(["renderEmailArtwork"]),
  "@/lib/weekly-recap": services(["buildWeeklyRecapSnapshot", "ensureWeeklyRecapSnapshot", "ensurePlayoffDayRecapSnapshot", "ensureFreshSlateSnapshot", "ensureGameDaySlateSnapshot", "ensureEarlyLockSnapshot", "ensureSundayRevealSnapshot", "ensureFeaturedWindowRevealSnapshot", "ensurePlayoffPublicRevealSnapshot"]),
  "@/lib/bowl-pool-recap": services(["ensureBowlDailyRecapSnapshot", "ensureBowlLineLockSnapshot"]),
  "@/lib/reminder-readiness": services(["reminderReadiness"]),
  "@/lib/weekly-recap-period": services(["findLatestSettledWeeklyRecapPeriod"]),
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = specifier === "@supabase/supabase-js"
      ? "export function createClient(){ return globalThis.commissionerAuthClient; }"
      : specifier === "@/lib/supabase-admin"
        ? "export const supabaseAdmin = globalThis.commissionerAuthDatabase;"
        : serviceModules[specifier];
    if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { requireCommissionerAccess } = await import("../src/lib/require-commissioner.ts");
const { AutomationAlreadyRunningError } = await import("@/lib/automation-execution-lease");
const request = (authorization = "Bearer fixture-token") => new Request("https://pool.example/api/admin/test", {
  headers: authorization ? { authorization } : {},
});

test("commissioner access verifies identity, role, and name on each request", async () => {
  assert.deepEqual(await requireCommissionerAccess(request()), { ok: true, player: commissioner });
  assert.deepEqual(state.authCalls, ["fixture-token"]);
  assert.equal(state.profileCalls.length, 1);
  state.profile = { data: { ...commissioner, is_commissioner: false }, error: null };
  assert.deepEqual(await requireCommissionerAccess(request()), { ok: false, status: 403, code: "commissioner_required" });
  assert.equal(state.profileCalls.length, 2, "role changes cannot be hidden by a cached authorization");
});

test("commissioner profile reads retain bounded retries for transient failures", async () => {
  state.profileQueue = [{ data: null, error: { status: 503 } }, state.profile];
  assert.equal((await requireCommissionerAccess(request())).ok, true);
  assert.equal(state.profileCalls.length, 2);
  state.profile = { data: null, error: { status: 503 } };
  assert.deepEqual(await requireCommissionerAccess(request()), { ok: false, status: 503, code: "profile_unavailable" });
  assert.equal(state.profileCalls.length, 5);
});

test("thrown access dependency failures remain unavailable rather than denied", async () => {
  state.verified = new Error("auth transport unavailable");
  assert.deepEqual(await requireCommissionerAccess(request()), { ok: false, status: 503, code: "auth_unavailable" });
  reset();
  state.profile = new Error("profile transport unavailable");
  assert.deepEqual(await requireCommissionerAccess(request()), { ok: false, status: 503, code: "profile_unavailable" });
});

const routes = {};
const routeMethods = {
  "account-capacity": ["GET"], "automation-health": ["GET"], "bowl-pool-readiness": ["GET"],
  "opening-week-checklist": ["GET"], "season-readiness": ["GET"], "operations-map": ["GET"], "grading-dashboard": ["GET"],
  "automation-preflight": ["GET"], "game-disruptions": ["POST"], "game-exceptions": ["GET"],
  "import-full-schedule": ["GET", "POST"], "import-games": ["POST"], "import-preview": ["GET"], "odds-preview": ["GET"],
  "bowl-pool/schedule": ["GET", "POST"], "bowl-pool/exceptions": ["GET", "POST"],
  "players": ["GET", "POST"], "reminder-templates": ["GET", "PUT", "DELETE"],
  "reminders": ["GET"], "reminders/[id]": ["PATCH"], "reminders/test": ["POST"], "reminders/preview": ["POST"],
  "lock-lines": ["GET", "POST"], "sync-scores": ["GET", "POST"], "watchdog": ["GET", "POST"],
  "season-bootstrap-status": ["GET", "POST"], "reconcile-finals": ["POST"],
  "integrity-rehearsal": ["GET"], "season-recovery-rehearsal": ["GET"],
};
for (const [name, methods] of Object.entries(routeMethods)) {
  const routeHandlers = await import(`../src/app/api/admin/${name}/route.ts`);
  for (const method of methods) {
    routes[`${method} ${name}`] = routeHandlers[method];
    test(`${method} ${name} preserves access failures before protected work`, async () => {
    const cases = [
      { status: 401, code: "session_invalid", authorization: "Bearer two tokens" },
      { status: 401, code: "session_invalid", verified: { data: { user: null }, error: { status: 401 } } },
      { status: 403, code: "player_inactive", profile: { data: { ...commissioner, active: false }, error: null } },
      { status: 403, code: "commissioner_required", profile: { data: { ...commissioner, is_commissioner: false }, error: null } },
      { status: 503, code: "auth_unavailable", verified: { data: { user: null }, error: { status: 503 } } },
      { status: 503, code: "profile_unavailable", profile: { data: null, error: { code: "test_database_error" } } },
      { status: 500, code: "auth_not_configured", unconfigured: true },
    ];
    for (const scenario of cases) {
      reset();
      if (scenario.verified) state.verified = scenario.verified;
      if (scenario.profile) state.profile = scenario.profile;
      if (scenario.unconfigured) delete process.env.SUPABASE_SECRET_KEY;
      const input = new Request(`https://pool.example/api/admin/${name}`, {
        method,
        headers: { authorization: scenario.authorization ?? "Bearer fixture-token" },
        ...(method === "GET" ? {} : { body: "{}" }),
      });
      const response = await routeHandlers[method](input, { params: Promise.resolve({ id: "fixture-reminder" }) });
      assert.equal(response.status, scenario.status, scenario.code);
      const body = await response.json();
      assert.equal(body.code, scenario.code);
      assert.equal(typeof body.error, "string");
      if (scenario.status === 403) assert.equal(body.error, "Commissioner access is required.");
      assert.deepEqual(state.workCalls, [], `${scenario.code} must stop protected work`);
      assert.equal(input.bodyUsed, false, "access failures stop before parsing a mutation body");
      if (scenario.unconfigured || scenario.authorization) assert.deepEqual(state.authCalls, []);
    }
    });
  }
}

test("authorized account-capacity reads still return the expected response", async () => {
  const response = await routes["GET account-capacity"](request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.accounts, []);
  assert.deepEqual(body.storageTables, []);
  assert.ok(Number.isFinite(Date.parse(body.checkedAt)));
  assert.deepEqual(state.workCalls, ["accounts", "storage"]);
});

test("authorized automation-health reads still return their health result", async () => {
  const response = await routes["GET automation-health"](request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "healthy" });
  assert.deepEqual(state.workCalls, ["health"]);
});

const mutationRequest = (body = {}, authorization = "Bearer fixture-token") => new Request("https://pool.example/api/admin/test", {
  method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(body),
});

test("disruption audit identity comes from the verified commissioner, never the submitted body", async () => {
  state.rpcResult = { data: [{ ats_voided: 1, survivor_voided: 1 }], error: null };
  const response = await routes["POST game-disruptions"](mutationRequest({ gameId: "game-1", status: "postponed", actor_player_id: "spoof" }));
  assert.equal(response.status, 200);
  assert.deepEqual(state.rpcCalls, [["record_game_disruption", {
    target_game_id: "game-1", disruption_status: "postponed", actor_player_id: commissioner.id,
  }]]);
});

test("authorized line locks retain their execution lease and cancellation signal", async () => {
  state.serviceResults.lockDueLines = { dueGames: 0, lockedGames: 0, missingGames: [] };
  const response = await routes["POST lock-lines"](mutationRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(state.workCalls, ["lease:line_locks", "lockDueLines"]);
  const [name, [now, signal]] = state.serviceArguments[0];
  assert.equal(name, "lockDueLines");
  assert.ok(now instanceof Date);
  assert.equal(signal, state.leaseSignal);
});

test("authorized score recovery retains its execution lease, signal, and explicit cooldown override", async () => {
  state.serviceResults.syncFinalScores = { weekRollover: { action: "none" }, providerChecked: false };
  const response = await routes["POST sync-scores"](mutationRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(state.workCalls, ["lease:scores", "syncFinalScores"]);
  assert.deepEqual(state.serviceArguments, [["syncFinalScores", [{ bypassProviderCooldown: true, signal: state.leaseSignal }]]]);
});

test("overlapping commissioner workers return conflict without executing work", async () => {
  for (const [route, job] of [["lock-lines", "line_locks"], ["sync-scores", "scores"], ["import-games", "schedule_refresh"]]) {
    reset();
    state.leaseError = new AutomationAlreadyRunningError("Already running");
    const response = await routes[`POST ${route}`](mutationRequest());
    assert.equal(response.status, 409, route);
    assert.deepEqual(state.workCalls, [`lease:${job}`]);
    assert.deepEqual(state.serviceArguments, []);
  }
});

test("scheduled import accepts only its exact configured secret and preserves duplicate-run handling", async () => {
  state.verified = new Error("User auth must not be called for a cron dispatch");
  state.leaseError = new AutomationAlreadyRunningError("Already running");
  const response = await routes["POST import-games"](mutationRequest({}, "Bearer fixture-cron-secret"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).skipped, true);
  assert.deepEqual(state.authCalls, []);
  assert.deepEqual(state.profileCalls, []);
  assert.deepEqual(state.workCalls, ["lease:schedule_refresh"]);

  reset();
  state.verified = { data: { user: null }, error: { status: 401 } };
  const denied = await routes["POST import-games"](mutationRequest({}, "Bearer fixture-cron-secret-wrong"));
  assert.equal(denied.status, 401);
  assert.deepEqual(state.workCalls, []);
});
