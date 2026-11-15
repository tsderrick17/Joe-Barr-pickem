// Renders the clubhouse room pictures with headless Chromium's software WebGL.
// Usage: node render.mjs [out-folder]      (default: ../../public/lab/clubhouse)
// Writes room-{day,night}[-bowl][-wide].webp and the tap spots (where each thing sits in the picture) to src/lib/lab-clubhouse-room.json.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const outDir = process.argv[2] ?? fileURLToPath(new URL("../../public/lab/clubhouse/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const server = await startServer(5620);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("console", (message) => { if (["error", "warning"].includes(message.type())) console.log("[page]", message.text().slice(0, 300)); });
page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 400)));
const spots = {};
// The tall pictures are for a phone. The wide ones are the desktop's: the same room from the same spot through a longer lens, the whole
// room in one view (both side walls, the bar, the boards, the fireplace and the table).
const WIDE = "w=880&h=520&fov=48";
const views = [["day", ""], ["night", "night=1"], ["day-bowl", "bowl=1"], ["night-bowl", "night=1&bowl=1"]];
// Each picture also gets its moving patches (the fans turning, the indoor plants swaying): a strip of FRAMES small pictures per patch.
const FRAMES = 16;
for (const [name, base] of [...views, ...views.map(([name, query]) => [`${name}-wide`, [query, WIDE].filter(Boolean).join("&")])]) {
  const query = [base, `frames=${FRAMES}`].filter(Boolean).join("&");
  const started = Date.now();
  await page.goto(`http://localhost:5620/scene.html?${query}`);
  await page.waitForFunction(() => window.__done === true || window.__error, undefined, { timeout: 900_000, polling: 500 });
  const error = await page.evaluate(() => window.__error);
  if (error) { console.log("RENDER ERROR", error); await browser.close(); server.close(); process.exit(1); }
  const webp = await page.evaluate(() => window.__webp);
  writeFileSync(`${outDir}/room-${name}.webp`, Buffer.from(webp.split(",")[1], "base64"));
  if (process.env.PNG) writeFileSync(`${outDir}/room-${name}.png`, Buffer.from((await page.evaluate(() => window.__png)).split(",")[1], "base64"));
  const motion = await page.evaluate(() => window.__motion);
  for (const patch of motion.patches) writeFileSync(`${outDir}/room-${name}-${patch.name}.webp`, Buffer.from(patch.strip.split(",")[1], "base64"));
  spots[name] = { ...(await page.evaluate(() => window.__spots)), motion: { frames: motion.frames, patches: motion.patches.map(({ name: patch, x, y, w, h }) => ({ name: patch, x: Math.round(x * 1e5) / 1e5, y: Math.round(y * 1e5) / 1e5, w: Math.round(w * 1e5) / 1e5, h: Math.round(h * 1e5) / 1e5 })) } };
  console.log("rendered", name, `${Math.round((Date.now() - started) / 1000)}s`);
}
writeFileSync(fileURLToPath(new URL("../../src/lib/lab-clubhouse-room.json", import.meta.url)), `${JSON.stringify(spots, null, 2)}\n`);
await browser.close(); server.close();
