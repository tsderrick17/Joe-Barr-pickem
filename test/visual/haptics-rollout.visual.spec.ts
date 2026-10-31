import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { boardResponse } from "./slate-fixtures.mjs";

// Haptics where players tap: the Slate, the Notifications page, sign-in. The phone is scripted: an Android phone records every vibration it is
// asked for, an iPhone records every flip of the hidden switch that gives its tick. Nothing real is vibrated.
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
type Kind = "android" | "iphone" | "computer";
type Haptics = { vibrations: number[][]; ticks: number };

// `staleOff` is a phone that turned the old Vibration switch off before it was taken away: it must tick like any other.
async function scriptDevice(page: Page, kind: Kind, staleOff = false) {
  await page.addInitScript(([device, iphone, setting]) => {
    const state: Haptics = { vibrations: [], ticks: 0 };
    (window as unknown as { haptics: Haptics }).haptics = state;
    if (device === "android") Object.defineProperty(navigator, "vibrate", { value: (pattern: number[]) => { state.vibrations.push([...pattern]); return true; }, configurable: true });
    else delete (Navigator.prototype as { vibrate?: unknown }).vibrate;
    if (device === "iphone") Object.defineProperty(navigator, "userAgent", { get: () => iphone, configurable: true });
    if (device === "android") Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36", configurable: true });
    if (setting) try { window.localStorage.setItem("pickem-vibration", "off"); } catch { /* none */ }
    // Every flip of a switch is one tick.
    document.addEventListener("change", (event) => { if ((event.target as HTMLElement)?.hasAttribute?.("switch")) state.ticks += 1; }, true);
  }, [kind, IPHONE, staleOff]);
}

const read = (page: Page) => page.evaluate(() => (window as unknown as { haptics: Haptics }).haptics);

async function openSlate(page: Page, kind: Kind, { save = "ok", staleOff = false }: { save?: "ok" | "fail"; staleOff?: boolean } = {}) {
  const board = boardResponse("upcoming-unpicked");
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day", "visual-player");
  await scriptDevice(page, kind, staleOff);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/board**", (route) => route.fulfill({ json: board }));
  await page.route("**/api/picks", (route) => save === "ok" ? route.fulfill({ json: { message: "saved" } }) : route.fulfill({ status: 400, json: { error: "Your picks could not be saved: fixture." } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(board.serverTime) });
  await page.goto("/board");
  const receipt = page.locator("[aria-label='Your weekly receipt']");
  await expect(receipt).toBeVisible({ timeout: 30000 });
  return { receipt, team: page.locator(".slate-game-row button.slate-team-side").first() };
}

test("Slate on Android: a pick ticks, taking it back is lighter, saving buzzes success, a failed save warns", async ({ page }) => {
  const { receipt, team } = await openSlate(page, "android");
  const felt = async () => (await read(page)).vibrations;
  await team.click();
  await expect.poll(felt).toEqual([[10]]);
  await team.click();
  await expect.poll(felt).toEqual([[10], [6]]);
  await team.click();
  await expect.poll(felt).toEqual([[10], [6], [10]]);
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  await expect.poll(felt).toEqual([[10], [6], [10], [10], [14, 60, 14]]);
  await expect(receipt).not.toContainText(/READY TO SAVE/);
});

test("Slate on Android: a save that fails gives the warning buzz", async ({ page }) => {
  const { receipt, team } = await openSlate(page, "android", { save: "fail" });
  await team.click();
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  await expect(page.getByText("Your picks could not be saved: fixture.")).toBeVisible();
  expect((await read(page)).vibrations.at(-1)).toEqual([50, 70, 50]);
});

test("Slate on an iPhone: each tap on a team or Submit is one tick from the finger's own tap, and still picks and saves", async ({ page }) => {
  const { receipt, team } = await openSlate(page, "iphone");
  await expect(team.locator("[data-haptic-tap]")).toHaveCount(1);
  await team.click();
  expect((await read(page)).ticks).toBe(1);
  await expect(receipt).toContainText(/READY TO SAVE/);
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  expect((await read(page)).ticks).toBe(2);
  await expect(receipt).not.toContainText(/READY TO SAVE/);
});

test("Slate on a computer: nothing vibrates and nothing is laid over the buttons", async ({ page }) => {
  const { team } = await openSlate(page, "computer");
  await expect(page.locator("[data-haptic-tap]")).toHaveCount(0);
  await team.click();
  expect(await read(page)).toEqual({ vibrations: [], ticks: 0 });
});

test("a phone that turned the old Vibration switch off still buzzes on Android", async ({ page }) => {
  const { team, receipt } = await openSlate(page, "android", { staleOff: true });
  await team.click();
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  await expect.poll(async () => (await read(page)).vibrations).toEqual([[10], [10], [14, 60, 14]]);
});

test("a phone that turned the old Vibration switch off still ticks on an iPhone", async ({ page }) => {
  const { team, receipt } = await openSlate(page, "iphone", { staleOff: true });
  await expect(team.locator("[data-haptic-tap]")).toHaveCount(1);
  await team.click();
  await expect(receipt).toContainText(/READY TO SAVE/);
  expect((await read(page)).ticks).toBe(1);
});

async function openNotifications(page: Page, kind: Kind) {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await scriptDevice(page, kind);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { notificationEmail: "tyler@example.com", senderEmail: "pool@example.com", emailNotificationsEnabled: true, firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible({ timeout: 30_000 });
}

for (const kind of ["android", "iphone", "computer"] as const) {
  test(`the Notifications page has no switch to turn vibration off (${kind})`, async ({ page }) => {
    await openNotifications(page, kind);
    await expect(page.getByText(/Vibration|tap feel/i)).toHaveCount(0);
  });
}

test("on Android the Notifications choices buzz", async ({ page }) => {
  await openNotifications(page, "android");
  await page.getByRole("button", { name: /Essentials/ }).first().click();
  await expect.poll(async () => (await read(page)).vibrations.at(-1)).toEqual([10]);
});

test("on an iPhone the Notifications choices carry the tick layer and the tick boxes are the phone's own switches", async ({ page }) => {
  await openNotifications(page, "iphone");
  await expect(page.locator("button[aria-pressed] [data-haptic-tap]").first()).toBeAttached();
  await expect(page.locator("form input[type=checkbox][switch]").first()).toBeAttached();
  await page.getByRole("button", { name: /Essentials/ }).first().click();
  expect((await read(page)).ticks).toBe(1);
});

test("a wrong PIN gives the warning buzz on Android", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await scriptDevice(page, "android");
  await page.route("**/api/login", (route) => route.fulfill({ status: 401, json: { error: "That PIN is not right." } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/login");
  await page.locator("#pin").fill("0000");
  await page.getByRole("button", { name: /log in|sign in|enter/i }).click();
  await expect(page.getByText(/PIN/).first()).toBeVisible();
  await expect.poll(async () => (await read(page)).vibrations.at(-1)).toEqual([50, 70, 50]);
});
