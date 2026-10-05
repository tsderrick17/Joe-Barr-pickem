import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every Sentry setup uses the shared private data collection, never the removed sendDefaultPii", async () => {
  for (const file of ["instrumentation-client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) {
    const source = await read(file);
    assert.match(source, /dataCollection: PRIVATE_DATA_COLLECTION,/, file);
    assert.doesNotMatch(source, /sendDefaultPii/, file);
  }
});

test("the shared setting turns every category of collected data off", async () => {
  const source = await read("src/lib/sentry-data-collection.ts");
  for (const line of ["userInfo: false", "cookies: false", "httpHeaders: false", "httpBodies: []", "urlQueryParams: false", "databaseQueryData: false", "queues: false", "stackFrameVariables: false"]) {
    assert.ok(source.includes(line), line);
  }
  assert.ok(source.includes("graphQL: { document: false, variables: false }"));
  assert.ok(source.includes("genAI: { inputs: false, outputs: false }"));
});

test("withSentryConfig comes from the config entry point (Sentry 11 moved it out of the SDK bundle)", async () => {
  assert.match(await read("next.config.ts"), /import \{ withSentryConfig \} from "@sentry\/nextjs\/config";/);
});
