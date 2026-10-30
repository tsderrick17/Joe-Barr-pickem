import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// The Commissioner's "Feel test" on the Notifications page. The phone is scripted: an Android phone records every vibration it is asked for, an iPhone
// records every flip of the hidden switch that gives its tick. Nothing real is vibrated.
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
type Kind = "android" | "iphone" | "computer";

async function scriptDevice(page: Page, kind: Kind) {
  await page.addInitScript(([device, iphone]) => {
    const state = { vibrations: [] as number[][], ticks: 0 };
    (window as unknown as { haptics: typeof state }).haptics = state;
    if (device === "android") Object.defineProperty(navigator, "vibrate", { value: (pattern: number[]) => { state.vibrations.push([...pattern]); return true; }, configurable: true });
    else delete (Navigator.prototype as { vibrate?: unknown }).vibrate;
    if (device === "iphone") Object.defineProperty(navigator, "userAgent", { get: () => iphone, configurable: true });
    // Every flip of the hidden switch is one tick.
    document.addEventListener("change", (event) => { if ((event.target as HTMLElement)?.hasAttribute?.("switch")) state.ticks += 1; }, true);
  }, [kind, IPHONE]);
}

async function open(page: Page, kind: Kind, { commissioner = true, theme = "day", width = 390 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await signIn(page, theme);
  await scriptDevice(page, kind);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: {
    notificationEmail: "tyler@example.com", senderEmail: "pool@example.com", emailNotificationsEnabled: true,
    firstName: "Tyler", isCommissioner: commissioner, showPoolChat: false,
  } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible({ timeout: 30_000 });
  return { section: page.locator("[data-haptic-test]") };
}

const read = (page: Page) => page.evaluate(() => (window as unknown as { haptics: { vibrations: number[][]; ticks: number } }).haptics);

for (const [kind, label] of [["android", "Android phone"], ["iphone", "iPhone"]] as const) {
  test(`Feel test as it reads on an ${label}`, async ({ page }) => {
    const { section } = await open(page, kind);
    await expect(section).toHaveAttribute("data-haptic-test", kind);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; } nav { position: static !important; }" });
    await expect(section).toHaveScreenshot(`feel-test-${kind}-day-phone-390.png`);
  });
}

test("Feel test at night", async ({ page }) => {
  const { section } = await open(page, "android", { theme: "night" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } nav { position: static !important; }" });
  await expect(section).toHaveScreenshot("feel-test-android-night-phone-390.png");
});

test("on Android every button vibrates its own pattern and says what it sent", async ({ page }) => {
  const { section } = await open(page, "android");
  const expected: Record<string, number[]> = { Tick: [10], "Light tick": [6], "Lock-in": [26], Success: [14, 60, 14], Warning: [50, 70, 50], Ratchet: [8] };
  for (const [name, pattern] of Object.entries(expected)) {
    await section.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    expect((await read(page)).vibrations.at(-1), name).toEqual(pattern);
    await expect(section.getByRole("status")).toContainText(`${name}: vibration ${pattern.join("-")} ms`);
  }
});

test("on an iPhone the finger's tap on a choice flips the hidden switch over it, one tick a tap, and the button still answers exactly once", async ({ page }) => {
  const { section } = await open(page, "iphone");
  // Count the clicks that reach the Feel test: one per tap means the switch's own echo of the click is stopped.
  await section.evaluate((element) => { (window as unknown as { clicks: number }).clicks = 0; element.addEventListener("click", () => { (window as unknown as { clicks: number }).clicks += 1; }); });
  const clicks = () => page.evaluate(() => (window as unknown as { clicks: number }).clicks);
  for (const [index, name] of ["Tick", "Light tick", "Lock-in"].entries()) {
    const button = section.getByRole("button", { name: new RegExp(`^${name}`) });
    // The finger lands on the invisible switch label laid over the button, not on code.
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.hasAttribute("data-haptic-tap") ?? false, [box.x + box.width / 2, box.y + box.height / 2])).toBe(true);
    await button.click();
    expect((await read(page)).ticks, name).toBe(index + 1);
    expect(await clicks(), `${name} answers once`).toBe(index + 1);
    await expect(section.getByRole("status")).toContainText(`${name}: one iPhone tick, from your tap`);
  }
  await section.getByRole("button", { name: /^Success/ }).click();
  await section.getByRole("button", { name: /^Warning/ }).click();
  expect((await read(page)).ticks, "success and warning are silent on an iPhone").toBe(3);
  await expect(section.getByRole("status")).toContainText("Warning: nothing");
  // The plain switch to compare against.
  await section.getByRole("checkbox", { name: "Compare switch" }).click();
  expect((await read(page)).ticks).toBe(4);
});

test("on an iPhone the pretend pull stays silent (an iPhone only ticks at a tap)", async ({ page }) => {
  const { section } = await open(page, "iphone");
  const box = section.getByRole("img", { name: /Pretend pull/ });
  await box.scrollIntoViewIfNeeded();
  const frame = (await box.boundingBox())!;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 5);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 5 + 170, { steps: 8 });
  await page.mouse.up();
  expect((await read(page)).ticks).toBe(0);
  await expect(section.getByRole("status")).toContainText("Lock-in (let go at the bottom): nothing");
});

test("no hidden switch is added on an Android phone", async ({ page }) => {
  const { section } = await open(page, "android");
  await expect(section.locator("[data-haptic-tap]")).toHaveCount(0);
});

test("the pretend pull ticks a notch each time the count drops and lets go with a lock-in", async ({ page }) => {
  const { section } = await open(page, "android");
  const box = section.getByRole("img", { name: /Pretend pull/ });
  await box.scrollIntoViewIfNeeded();
  const frame = (await box.boundingBox())!;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 5);
  await page.mouse.down();
  await expect(box).toHaveAttribute("data-pull-count", "4");
  for (const [step, count] of [[1, "3"], [2, "2"], [3, "1"], [4, "0"]] as const) {
    await page.mouse.move(frame.x + frame.width / 2, frame.y + 5 + step * 40, { steps: 4 });
    await expect(box).toHaveAttribute("data-pull-count", count);
  }
  await page.mouse.up();
  const { vibrations } = await read(page);
  expect(vibrations.slice(0, 4), "four notches going down").toEqual([[8], [8], [8], [8]]);
  expect(vibrations.at(-1), "a heavier tap on letting go at the bottom").toEqual([26]);
  await expect(box).toHaveAttribute("data-pull-count", "4");
});

test("letting go before the bottom is not a lock-in", async ({ page }) => {
  const { section } = await open(page, "android");
  const box = section.getByRole("img", { name: /Pretend pull/ });
  await box.scrollIntoViewIfNeeded();
  const frame = (await box.boundingBox())!;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 5);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 5 + 45, { steps: 4 });
  await page.mouse.up();
  expect((await read(page)).vibrations).toEqual([[8]]);
});

test("a computer says it has no haptics and does nothing", async ({ page }) => {
  const { section } = await open(page, "computer", { width: 1280 });
  await expect(section).toHaveAttribute("data-haptic-test", "none");
  await section.getByRole("button", { name: /^Tick/ }).click();
  expect(await read(page)).toEqual({ vibrations: [], ticks: 0 });
  await expect(section.getByRole("status")).toContainText("nothing (this device has no haptics)");
});

test("only the Commissioner sees the Feel test", async ({ page }) => {
  await open(page, "android", { commissioner: false });
  await expect(page.locator("[data-haptic-test]")).toHaveCount(0);
});
