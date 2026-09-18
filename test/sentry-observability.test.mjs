import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("Sentry keeps production errors actionable and privacy-safe", () => {
  const browser = read("instrumentation-client.ts");
  const server = read("sentry.server.config.ts");
  const edge = read("sentry.edge.config.ts");
  const filter = read("src/lib/sentry-event-filter.ts");

  assert.match(browser, /tracesSampleRate:\s*0\.05/);
  assert.match(browser, /replaysSessionSampleRate:\s*0/);
  assert.match(browser, /replaysOnErrorSampleRate:\s*1/);
  assert.match(browser, /maskAllText:\s*true/);
  assert.match(browser, /blockAllMedia:\s*true/);
  assert.match(server, /prepareSentryEvent/);
  assert.match(edge, /prepareSentryEvent/);
  assert.match(filter, /app\.route/);
  assert.match(filter, /delete event\.user/);
});

test("admin player loading handles network failures and reports safe context", () => {
  const page = read("src/app/admin/players/page.tsx");
  assert.match(page, /fetchWithSession/);
  assert.match(page, /SessionUnavailableError/);
  assert.match(page, /error\.kind.*network/s);
  assert.match(page, /endpoint: "\/api\/admin\/players"/);
  assert.match(page, /Check your connection and try again/);
});
