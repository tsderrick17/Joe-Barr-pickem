import { expect, test, type Page } from "@playwright/test";

// The player rehearsal at /preview, walked through: the six scenarios the Commissioner uses to check a week before it goes live, in each of the four views.
// No screenshots are compared (the Account "preview" and "preview-player" states cover how it looks); this checks what each scenario shows, who may open it,
// and the two layout guards (aligned team lanes, no sideways scroll) that used to run unsigned against the real app.
async function open(page: Page, { commissioner = true } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: commissioner } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/preview");
  if (commissioner) await expect(page.locator("#rehearsal-scenario")).toBeVisible({ timeout: 30_000 });
}
const scenario = (page: Page, value: string) => page.locator("#rehearsal-scenario").selectOption(value);
const view = (page: Page, name: "Ticket" | "Slate" | "Pick'em Pad" | "Email") => page.getByRole("group", { name: "Rehearsal view" }).getByRole("button", { name, exact: true }).click();
const ticket = (page: Page) => page.getByRole("region", { name: "Rehearsal personal ticket" });
const pad = (page: Page) => page.getByRole("region", { name: "Rehearsal Pick'em Pad" });
const images = (page: Page) => page.getByRole("img").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")).filter((label) => label?.startsWith("Sample")));

test("the rehearsal offers the six stages of a week, from a blank ticket to the playoff round", async ({ page }) => {
  await open(page);
  const labels = await page.locator("#rehearsal-scenario option").allTextContents();
  expect(labels).toEqual([
    "Week 4 - fresh blank ticket", "Week 4 - Saturday before kickoff", "Week 4 - Sunday 3 PM ET",
    "Week 4 - final + weekly recap email", "Week 5 - safe handoff", "Wild Card Sunday - partial locks",
  ]);
});

test("a fresh ticket is blank, and the safe handoff opens Week 5 as a new blank ticket while the Pad keeps the completed record's players", async ({ page }) => {
  await open(page);
  await expect(ticket(page)).toContainText(/week 4/i);
  await expect(ticket(page)).toContainText("0/3 SELECTIONS MADE");
  await expect(ticket(page)).not.toContainText("Jaguars");
  await scenario(page, "handoff");
  await expect(ticket(page)).toContainText(/week 5/i);
  await expect(ticket(page)).toContainText("0/3 SELECTIONS MADE");
  await expect(ticket(page).getByText(/^[WL]$/)).toHaveCount(0);   // no stamps on the new week
  await view(page, "Pick'em Pad");
  await expect(pad(page)).toContainText(/week 5/i);
  await expect(pad(page)).toContainText("Tyler");   // the standings carry over; the completed week's picks do not
  await expect(pad(page)).not.toContainText(/Jax|KC/);
});

test("Monday's final ticket keeps its W and L stamps, the Pad counts only W marks, and nothing is counted before its game is final", async ({ page }) => {
  await open(page);
  await scenario(page, "final");
  await expect(ticket(page)).toContainText("3/3 SELECTIONS MADE");
  await expect(ticket(page)).toContainText("SUBMITTED");
  await expect(ticket(page).getByText("W", { exact: true }).first()).toBeVisible();
  await expect(ticket(page).getByText("L", { exact: true }).first()).toBeVisible();
  await view(page, "Pick'em Pad");
  const rows = (await pad(page).innerText()).split("\n").filter((line) => /^\d\t/.test(line));
  const wins = (name: string) => Number(rows.find((row) => row.includes(name))!.split("\t")[0]);
  const stamps = (name: string) => (rows.find((row) => row.includes(name))!.match(/[WL](?=\t|$)/g) ?? []).join("");
  // Tyler had 4 wins coming in and went W, L this week; Gary W, L; Zac L, W. A W adds one, an L adds nothing.
  expect([wins("Tyler"), wins("Gary"), wins("Zac")]).toEqual([5, 4, 4]);
  expect([stamps("Tyler"), stamps("Gary"), stamps("Zac")]).toEqual(["WL", "WL", "LW"]);
  await scenario(page, "saturday");
  const before = (await pad(page).innerText()).split("\n").filter((line) => /^\d\t/.test(line));
  expect(before.map((row) => Number(row.split("\t")[0]))).toEqual([4, 3, 3]);   // no game is final yet, so no win has been added
});

test("the playoff round shows six selections for Tyler, and other players' unstarted games stay sealed", async ({ page }) => {
  await open(page);
  await scenario(page, "playoff");
  await expect(ticket(page)).toContainText(/wild card round/i);
  await expect(ticket(page)).toContainText("6/6 SELECTIONS MADE");
  await view(page, "Pick'em Pad");
  const text = await pad(page).innerText();
  expect(text).toMatch(/wild card round/i);
  const gary = text.split("\n").find((line) => line.includes("Gary"))!;
  expect(gary.split("\t").filter((cell) => cell === "🔒")).toHaveLength(3);   // started games are public, the three later ones are sealed
  const tyler = text.split("\n").find((line) => line.includes("Tyler"))!;
  expect(tyler).not.toContain("🔒");   // a player always sees their own
});

test("each email scenario carries its sample image: the Slate before lines lock, public picks once games start, and the final recap with the Survivor table", async ({ page }) => {
  await open(page);
  await view(page, "Email");
  const expected: Record<string, string[]> = {
    open: ["Sample Slate image included in this email"],
    saturday: ["Sample Slate image included in this email"],
    sunday: ["Sample public picks image included in this email"],
    final: ["Sample final recap image included in this email", "Sample Survivor recap image included in this email"],
    handoff: ["Sample Slate image included in this email"],
    playoff: ["Sample public picks image included in this email"],
  };
  for (const [value, labels] of Object.entries(expected)) {
    await scenario(page, value);
    expect(await images(page), value).toEqual(labels);
    await expect(page.getByText("EMAIL PREVIEW - NEVER SENT")).toBeVisible();
  }
  await scenario(page, "sunday");
  await expect(page.getByText("FUTURE SELECTIONS REMAIN PRIVATE")).toBeVisible();   // a reveal email shows only started games
  await scenario(page, "final");
  await expect(page.getByText("Tuesday - 6:30 AM ET")).toBeVisible();
  await expect(page.getByText("FINAL W/L STAMPS REMAIN MEMORIALIZED")).toBeVisible();
  await expect(page.getByText("ZAC WAS ELIMINATED THIS WEEK · 2 ENTRIES REMAIN")).toBeVisible();
});

test("the rehearsal is the Commissioner's: a signed-in player who is not the Commissioner sees a plain message, never the sample picks", async ({ page }) => {
  await open(page, { commissioner: false });
  await expect(page.getByRole("heading", { name: "Commissioner only" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Back to the Standings" })).toHaveAttribute("href", "/");
  await expect(page.locator("#rehearsal-scenario")).toHaveCount(0);
  await expect(page.getByText("Sample", { exact: false })).toHaveCount(0);
});

test("desktop slate keeps chipless team lanes aligned", async ({ page }) => {
  await open(page);
  await view(page, "Slate");
  await expect(page.getByRole("heading", { name: /ATS SLATE/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const rightEdges = await page.locator(".slate-game-row:not(.is-final) .slate-team-label-lane.is-right").evaluateAll((nodes) => nodes.map((node) => Math.round((node as HTMLElement).getBoundingClientRect().left)));
  expect(rightEdges.length).toBeGreaterThan(3);
  expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1);
});

test("mobile rehearsal surfaces fit without horizontal overflow", async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await view(page, "Pick'em Pad");
  await expect(page.locator("h1").filter({ hasText: "Pick'em Pad" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
