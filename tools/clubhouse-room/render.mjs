// Renders the clubhouse room pictures with headless Chromium's software WebGL.
// Usage: node render.mjs [out-folder]      (default: ../../public/lab/clubhouse)
// Writes room-{day,night}[-bowl][-wide|-full].webp and the tap spots (where each thing sits in the picture) to src/lib/lab-clubhouse-room.json.
// ONLY=day-full,night-full renders just those pictures and keeps every other picture's spots as they are.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const outDir = process.argv[2] ?? fileURLToPath(new URL("../../public/lab/clubhouse/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const server = await startServer(5620);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("console", (message) => { if (["error", "warning"].includes(message.type())) console.log("[page]", message.text().slice(0, 300)); });
page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 400)));
const spotsFile = fileURLToPath(new URL("../../src/lib/lab-clubhouse-room.json", import.meta.url));
const spots = existsSync(spotsFile) ? JSON.parse(readFileSync(spotsFile, "utf8")) : {};
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
// The tall pictures are for a phone. The wide ones are the desktop's: the same room from the same spot through a longer lens, the whole
// room in one view (both side walls, the bar, the boards, the fireplace and the table).
const WIDE = "w=880&h=520&fov=48";
// The full-screen pictures are the real clubhouse's on a phone: taller, to fill the screen under the site's bar, with a wider view up
// and down (fov 75) so the room is as wide side to side as the Lab's tall picture.
const FULL = "w=390&h=700&fov=75";
const views = [["day", ""], ["night", "night=1"], ["day-bowl", "bowl=1"], ["night-bowl", "night=1&bowl=1"]];
// Nothing in the room moves but its two boards (the owner turned the turning fans and swaying plants down), so no frame strips are drawn.
for (const [name, base] of [...views, ...views.map(([name, query]) => [`${name}-wide`, [query, WIDE].filter(Boolean).join("&")]), ...views.map(([name, query]) => [`${name}-full`, [query, FULL].filter(Boolean).join("&")])]) {
  if (only && !only.has(name)) continue;
  const query = base;
  const started = Date.now();
  await page.goto(`http://localhost:5620/scene.html?${query}`);
  await page.waitForFunction(() => window.__done === true || window.__error, undefined, { timeout: 900_000, polling: 500 });
  const error = await page.evaluate(() => window.__error);
  if (error) { console.log("RENDER ERROR", error); await browser.close(); server.close(); process.exit(1); }
  const webp = await page.evaluate(() => window.__webp);
  writeFileSync(`${outDir}/room-${name}.webp`, Buffer.from(webp.split(",")[1], "base64"));
  if (process.env.PNG) writeFileSync(`${outDir}/room-${name}.png`, Buffer.from((await page.evaluate(() => window.__png)).split(",")[1], "base64"));
  spots[name] = await page.evaluate(() => window.__spots);
  console.log("rendered", name, `${Math.round((Date.now() - started) / 1000)}s`);
}
writeFileSync(fileURLToPath(new URL("../../src/lib/lab-clubhouse-room.json", import.meta.url)), `${JSON.stringify(spots, null, 2)}\n`);
await browser.close(); server.close();
