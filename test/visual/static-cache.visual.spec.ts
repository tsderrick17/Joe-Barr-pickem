import { expect, test } from "@playwright/test";

// The pictures that rarely change are kept by the phone for a day (then refreshed in the background); pages, data and the service worker
// are never kept, so a change to the app or a grade always shows at once. No screenshots.
const KEPT = "public, max-age=86400, stale-while-revalidate=2592000";

test("trophy frames, team logos and the loading football are kept for a day", async ({ request }) => {
  for (const path of ["/trophies/turntable/frame-000.webp", "/team-logos/KC.png", "/football-spin.webp"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"], path).toBe(KEPT);
  }
});

test("pages and the service worker are not kept", async ({ request }) => {
  for (const path of ["/login", "/sw.js", "/manifest.webmanifest"]) {
    const response = await request.get(path);
    expect(response.headers()["cache-control"] ?? "", path).not.toContain("max-age=86400");
  }
});
