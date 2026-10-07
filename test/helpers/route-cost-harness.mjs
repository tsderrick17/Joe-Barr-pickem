import "./typescript-renderer.mjs";
import { registerHooks } from "node:module";
import { createFakeDatabase } from "./fake-pool-database.mjs";

// Runs the real /api/home and /api/board handlers against a fake database and reports what they cost.
globalThis.routeCostPlayer = null;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = { from: (...args) => globalThis.routeCostDb.client.from(...args), rpc: (...args) => globalThis.routeCostDb.client.rpc(...args), auth: { admin: {} } };", shortCircuit: true };
    if (specifier === "@/lib/authenticate-active-player") return { url: "data:text/javascript,export const authenticateActivePlayer = async () => ({ ok: true, player: globalThis.routeCostPlayer });", shortCircuit: true };
    if (specifier === "next/server") return { url: new URL("./next-server-stub.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "fixture-publishable-key";

const handlers = {
  home: () => import("../../src/app/api/home/route.ts"),
  board: () => import("../../src/app/api/board/route.ts"),
};

/** One route read: the response size and status, and every database request it made. */
export async function measureRoute({ route, tables, rpc = {}, player, query = "" }) {
  const db = createFakeDatabase(tables, { rpc });
  globalThis.routeCostDb = db;
  globalThis.routeCostPlayer = player;
  globalThis.routeAfterCallbacks = [];
  const { GET } = await handlers[route]();
  const response = await GET(new Request(`http://localhost/api/${route}${query}`, { headers: { authorization: "Bearer fixture" } }));
  const body = await response.text();
  const byTable = {};
  for (const request of db.requests) {
    const key = request.kind === "rpc" ? `rpc:${request.table}` : `${request.op}:${request.table}`;
    byTable[key] ??= { requests: 0, rows: 0, bytes: 0 };
    byTable[key].requests += 1; byTable[key].rows += request.rows; byTable[key].bytes += request.bytes;
  }
  return {
    status: response.status,
    responseBytes: Buffer.byteLength(body),
    requests: db.requests.length,
    rows: db.requests.reduce((sum, request) => sum + request.rows, 0),
    databaseBytes: db.requests.reduce((sum, request) => sum + request.bytes, 0),
    byTable,
    body,
    afterCallbacks: globalThis.routeAfterCallbacks.length,
  };
}
