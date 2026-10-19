// Renders the turntable: the three trophies on their triangular table, one picture for every 3 degrees of a full turn.
// Usage: node turntable.mjs [champions.json] [outDir]
// champions.json is { "pickem": [{ "year": "2025", "name": "STEVE" }], "bowl": [...], "survivor": [...] }, newest first in each pool;
// it decides which plaques are engraved. The pictures are written as frame-000.webp ... frame-119.webp (rest positions: 000, 040, 080).
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { startServer } from "./serve.mjs";

const [championsFile, outDir = "out/turntable"] = process.argv.slice(2);
const champions = championsFile ? readFileSync(championsFile, "utf8").trim() : "";
const STEP = 3, FRAMES = 360 / STEP, WIDTH = 1100, HEIGHT = 825;
mkdirSync(outDir, { recursive: true });
// FRAME_PART="k/n" renders only every n-th frame starting at k, so several runs can share the work (each needs its own PORT)
const [partIndex, partCount] = (process.env.FRAME_PART ?? "0/1").split("/").map(Number);
const port = Number(process.env.PORT ?? 5599);
const server = await startServer(port);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
for (let i = partIndex; i < FRAMES; i += partCount) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 300)));
  await page.goto(`http://localhost:${port}/scene.html?scene=turntable&w=${WIDTH}&h=${HEIGHT}&rot=${i * STEP}${champions ? `&champions=${encodeURIComponent(champions)}` : ""}`);
  await page.waitForFunction(() => window.__done === true || window.__error, undefined, { timeout: 300_000, polling: 250 });
  const error = await page.evaluate(() => window.__error);
  if (error) { console.log("RENDER ERROR", error); process.exit(1); }
  const data = await page.evaluate(() => window.__webp);
  writeFileSync(`${outDir}/frame-${String(i).padStart(3, "0")}.webp`, Buffer.from(data.split(",")[1], "base64"));
  await page.close();
  console.log("frame", i + 1, "of", FRAMES);
}
await browser.close(); server.close();
