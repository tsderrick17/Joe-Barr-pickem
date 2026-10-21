import { expect, test, type Page } from "@playwright/test";
import { bowlResponse } from "./standings-fixtures.mjs";

// The Bowl Pool's player flow, driven in a real browser against a server that remembers what it was sent: claim a seat, choose teams, submit, opt out.
// These replace a test that matched the page's source text; no screenshots are compared here.
const NOW = "2026-12-12T15:00:00Z";   // the bowl season is about to start: entry is open

async function open(page: Page, initial: { optedIn: boolean }) {
  const state = { optedIn: initial.optedIn, saved: [] as Array<{ gameId: string; side: string }>, posts: [] as Array<{ optedIn: boolean; selections: Array<{ gameId: string; teamId: string; side: string }>; championshipTotalGuess: number | null }> };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/bowl-pool**", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.posts.push(body);
      state.optedIn = body.optedIn;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: bowlResponse({ optedIn: state.optedIn, entryOpen: true }) });
  });
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(NOW) });
  await page.goto("/bowl-pool");
  return state;
}

test("claiming a seat opens the selection card, choosing and submitting saves the picks, and opting out takes the seat back", async ({ page }) => {
  const state = await open(page, { optedIn: false });
  await expect(page.getByRole("heading", { name: "Claim your seat in the Bowl Pool" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#bowl-selections")).toHaveCount(0);   // nothing to pick until the seat is claimed

  await page.getByRole("button", { name: "CLAIM YOUR SEAT" }).click();
  await expect(page.locator("#bowl-selections")).toBeVisible();
  await expect.poll(() => state.posts.length).toBe(1);
  expect(state.posts[0].optedIn).toBe(true);

  await page.locator("#bowl-selections button[aria-label^='Select favorite team']").first().click();
  await expect(page.getByText(/CHANGED · SUBMIT TO SAVE/)).toBeVisible();   // the receipt says the choice is not saved yet
  await page.getByRole("button", { name: "SUBMIT" }).click();
  await expect.poll(() => state.posts.length).toBe(2);
  expect(state.posts[1].optedIn).toBe(true);
  expect(state.posts[1].selections.length, "the chosen team is sent").toBe(1);
  expect(state.posts[1].selections[0].side).toBe("favorite");
  await expect(page.getByText(/CHANGED · SUBMIT TO SAVE/)).toHaveCount(0);   // saved

  await page.getByRole("button", { name: "Opt out" }).click();
  await expect.poll(() => state.posts.length).toBe(3);
  expect(state.posts[2].optedIn).toBe(false);
  expect(state.posts[2].selections, "opting out sends no picks").toEqual([]);
  await expect(page.getByRole("heading", { name: "Claim your seat in the Bowl Pool" })).toBeVisible();
});
