#!/usr/bin/env node
// Runs the real /api/home and /api/board handlers against fictional, season-sized fixtures and an in-memory
// database, and reports what each read costs: database requests, rows, bytes read, and response bytes. Wall-clock
// time is deliberately not measured here (a fake database has no network); see docs/RESPONSE_COST_BASELINE.md.
//   npm run measure:routes            a readable table
//   npm run measure:routes -- --json  machine-readable (what the budgets are set from)
import { measureAllRoutes } from "../test/helpers/measure-all-routes.mjs";

const results = await measureAllRoutes();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([name, r]) => [name, { requests: r.requests, rows: r.rows, databaseBytes: r.databaseBytes, responseBytes: r.responseBytes }])), null, 2));
} else {
  console.log("route/scenario".padEnd(30), "requests".padStart(9), "rows".padStart(6), "db bytes".padStart(10), "response".padStart(10));
  for (const [name, r] of Object.entries(results)) console.log(name.padEnd(30), String(r.requests).padStart(9), String(r.rows).padStart(6), String(r.databaseBytes).padStart(10), String(r.responseBytes).padStart(10));
}
