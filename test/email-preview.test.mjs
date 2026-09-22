import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let authorized = true;
let databaseReads = 0;
const { emailArtworkSample } = await import("../src/lib/email-artwork-sample.ts");
const snapshot = emailArtworkSample("weekly_recap");
globalThis.emailPreviewCommissioner = () => authorized ? { id: "commissioner-fixture" } : null;
globalThis.emailPreviewDatabase = {
  from(table) {
    databaseReads++;
    const query = {
      select() { return query; }, eq() { return query; }, not() { return query; }, order() { return query; }, limit() { return query; },
      maybeSingle() { return Promise.resolve({ error: null, data: table === "push_reminders" ? { id: "fixture", category: "weekly_recap", audience: "all_active", title: "Saved subject", body: "Saved body", recap_snapshot: snapshot } : { title: "Saved subject", body: "Saved body", image_options: { density: "comfortable" } } }); },
      insert() { throw new Error("Preview must not insert"); }, update() { throw new Error("Preview must not update"); }, upsert() { throw new Error("Preview must not upsert"); },
    };
    return query;
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/require-commissioner") return { url: "data:text/javascript,export const requireCommissioner = async () => globalThis.emailPreviewCommissioner();", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.emailPreviewDatabase;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { POST } = await import("../src/app/api/admin/reminders/preview/route.ts");
const { messageHtml } = await import("../src/lib/email-reminders.ts");

test("email image preview requires commissioner access before reading data", async () => {
  authorized = false;
  const before = databaseReads;
  const response = await POST(new Request("http://localhost/api/admin/reminders/preview", { method: "POST", body: "{}" }));
  assert.equal(response.status, 403);
  assert.equal(databaseReads, before);
  authorized = true;
});

test("preview renders real PNGs, escapes edited wording and never writes a receipt", async () => {
  const response = await POST(new Request("http://localhost/api/admin/reminders/preview", { method: "POST", body: JSON.stringify({ templateId: "weekly_recap", title: "{{week}} recap", message: "<script>alert(1)</script>", imageOptions: { density: "compact" } }) }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const result = await response.json();
  assert.equal(result.images.length, 2);
  assert.match(result.html, /Sample week recap/);
  assert.doesNotMatch(result.html, /<script>/);
  assert.doesNotMatch(result.html, /api\/recap-image/);
  for (const image of result.images) {
    const png = Buffer.from(image.src.split(",")[1], "base64");
    assert.equal(png.subarray(1, 4).toString(), "PNG");
  }
});

test("delivery fixes density in each image URL and shows one combined summary", () => {
  const html = messageHtml({ id: "fixture", category: "weekly_recap", audience: "all_active", title: "Week recap", body: "Results", recap_snapshot: snapshot, imageOptions: { density: "comfortable" } });
  assert.equal((html.match(/kind=summary/g) ?? []).length, 1);
  assert.equal((html.match(/density=comfortable/g) ?? []).length, 2);
});
