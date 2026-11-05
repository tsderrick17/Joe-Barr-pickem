import type { Page } from "@playwright/test";

/**
 * Signs the browser in before the page runs: a session for a fictional player that never expires, stored where the Supabase client looks for it,
 * plus the day or night theme. No real account is involved; every spec answers the app's /api calls itself.
 */
export async function signIn(page: Page, theme = "day", playerId = "p2") {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: playerId, exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: playerId, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript(([value, mode]) => {
    window.localStorage.setItem("sb-placeholder-auth-token", value as string);
    window.localStorage.setItem("pickem-theme", mode as string);
  }, [JSON.stringify(session), theme]);
}

/**
 * Gives the page's requests a moment to finish before a screenshot. "networkidle" alone can wait out a test's whole minute when a request never quite
 * goes quiet (once on CI, the Bowl picks page on 2026-11-02), so it is bounded: the page's own content waits come first, and the screenshot assertion
 * still waits for two identical frames before it compares.
 */
export async function settleNetwork(page: Page, timeout = 10_000) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => undefined);
}
