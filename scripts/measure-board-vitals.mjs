#!/usr/bin/env node
// Lab measurement of the Slate page's Web Vitals: Largest Contentful Paint (and which element it was), Cumulative
// Layout Shift (and what moved), and the slowest interaction when a team is tapped. A slowed-down phone is emulated
// (4x CPU, slow 4G), and every /api call is answered from the screenshot fixtures after a delay that stands in for the
// server's response time. Not a test: run it before and after a speed change and compare.
//   node scripts/measure-board-vitals.mjs [--url http://127.0.0.1:3140] [--api-ms 600] [--runs 3] [--scenario upcoming-picked] [--width 390]
// Needs a running server, ideally a production build:
//   NEXT_DIST_DIR=.next-audit npm run build && NEXT_DIST_DIR=.next-audit npx next start -p 3140
import http from "node:http";
import { chromium } from "@playwright/test";
import { boardResponse } from "../test/visual/slate-fixtures.mjs";

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const baseUrl = option("url", "http://127.0.0.1:3140");
const apiMs = Number(option("api-ms", "600"));
const runs = Number(option("runs", "3"));
const scenario = option("scenario", "upcoming-unpicked");
const width = Number(option("width", "390"));

const vitalsScript = () => {
  const vitals = { lcp: null, lcpElement: null, cls: 0, shifts: [], interactions: [], rowsAt: null };
  window.__vitals = vitals;
  // When the first game row is drawn, timed by the page itself (not by the test's polling).
  new MutationObserver((_records, observer) => {
    if (document.querySelector(".slate-game-row")) { vitals.rowsAt = performance.now(); observer.disconnect(); }
  }).observe(document, { childList: true, subtree: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      vitals.lcp = entry.startTime;
      const element = entry.element;
      vitals.lcpElement = element ? `${element.tagName.toLowerCase()}.${String(element.className).split(" ").filter(Boolean).slice(0, 2).join(".")} "${(element.textContent ?? "").trim().slice(0, 40)}"` : null;
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      vitals.cls += entry.value;
      vitals.shifts.push({ at: Math.round(entry.startTime), value: Number(entry.value.toFixed(4)), nodes: entry.sources.map((source) => source.node ? `${source.node.nodeName.toLowerCase()}.${String(source.node.className ?? "").split(" ").filter(Boolean).slice(0, 2).join(".")}` : "?") });
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entry.interactionId) vitals.interactions.push({ name: entry.name, duration: entry.duration });
  }).observe({ type: "event", buffered: true, durationThreshold: 16 });
};

const board = boardResponse(scenario);
// The fixtures are served by a small proxy in front of the server rather than by the browser's request interception,
// because interception turns the browser cache off: a real returning player already has the scripts and fonts.
const target = new URL(baseUrl);
const apiAnswers = {
  "/api/board": board,
  "/api/profile": { firstName: "Tyler", isCommissioner: false, showPoolChat: false },
  "/api/pool-chat": { messages: [] },
};
const proxy = http.createServer((request, response) => {
  const path = new URL(request.url, "http://lab").pathname;
  if (path.startsWith("/api/")) {
    setTimeout(() => {
      const answer = apiAnswers[path];
      if (answer) { response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(answer)); }
      else { response.writeHead(204); response.end(); }
    }, apiMs);
    return;
  }
  const forward = http.request({ host: target.hostname, port: target.port, path: request.url, method: request.method, headers: request.headers }, (upstream) => {
    response.writeHead(upstream.statusCode ?? 502, upstream.headers);
    upstream.pipe(response);
  });
  request.pipe(forward);
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const labUrl = `http://127.0.0.1:${proxy.address().port}`;
const browser = await chromium.launch();
const results = [];
for (let run = 0; run < runs; run += 1) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "visual-player", exp: expiresAt, role: "authenticated" })}.lab`;
  const session = { access_token: accessToken, refresh_token: "lab", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "visual-player", aud: "authenticated", role: "authenticated" } };
  await page.addInitScript(([value]) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, [JSON.stringify(session)]);
  await page.addInitScript(vitalsScript);
  await page.clock.install({ time: new Date(board.serverTime) });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  // A returning visit: the first load fills the browser cache (fonts, scripts, pictures), the measured one reloads.
  await page.goto(`${labUrl}/board`);
  await page.locator(".slate-game-row").first().waitFor({ timeout: 60_000 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const started = Date.now();
  const timeline = [];
  const onRequest = (request) => timeline.push(`${String(Date.now() - started).padStart(5)} ms  start ${request.resourceType().padEnd(10)} ${request.url().replace(labUrl, "").slice(0, 90)}`);
  const onFinished = (request) => timeline.push(`${String(Date.now() - started).padStart(5)} ms  done  ${request.resourceType().padEnd(10)} ${request.url().replace(labUrl, "").slice(0, 90)}`);
  if (process.argv.includes("--timeline") && run === runs - 1) { page.on("request", onRequest); page.on("requestfinished", onFinished); }
  await page.reload();
  await page.locator(".slate-game-row").first().waitFor({ timeout: 60_000 });
  const slateVisibleMs = Date.now() - started;
  if (timeline.length) console.log([...timeline, `${String(slateVisibleMs).padStart(5)} ms  Slate rows visible`].join("\n"));
  await page.waitForTimeout(2500);
  const team = page.locator(".slate-game-row button:not([disabled])").first();
  if (await team.count()) { await team.tap(); await page.waitForTimeout(1500); }
  const vitals = await page.evaluate(() => window.__vitals);
  results.push({ slateVisibleMs, ...vitals, inp: Math.max(0, ...vitals.interactions.map((entry) => entry.duration)) });
  await context.close();
}
await browser.close();
proxy.close();

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(`Slate "${scenario}" at ${width}px, 4x CPU, slow 4G, ${apiMs} ms per API answer, ${runs} returning visits`);
console.log(`  First row drawn     ${Math.round(median(results.map((r) => r.rowsAt ?? 0)))} ms (median, from navigation)`);
console.log(`  LCP                 ${Math.round(median(results.map((r) => r.lcp ?? 0)))} ms   element: ${results.at(-1).lcpElement}`);
console.log(`  CLS                 ${median(results.map((r) => r.cls)).toFixed(3)}`);
console.log(`  Tap a team (INP)    ${Math.round(median(results.map((r) => r.inp)))} ms`);
for (const shift of results.at(-1).shifts) console.log(`    shift at ${shift.at} ms: ${shift.value} ${shift.nodes.join(", ")}`);
