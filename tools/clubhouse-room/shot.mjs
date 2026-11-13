// Design work: renders chosen views to PNG. Usage: node shot.mjs <out-folder> '[["name","query"],...]'
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { startServer } from "./serve.mjs";
const [outDir, variants = '[["day","scale=3"]]'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const server = await startServer(5622);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage();
page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 400)));
for (const [name, query] of JSON.parse(variants)) {
  await page.goto(`http://localhost:5622/scene.html?${query}`);
  await page.waitForFunction(() => window.__done === true || window.__error, undefined, { timeout: 900_000, polling: 500 });
  const error = await page.evaluate(() => window.__error);
  if (error) { console.log("RENDER ERROR", error); break; }
  writeFileSync(`${outDir}/${name}.png`, Buffer.from((await page.evaluate(() => window.__png)).split(",")[1], "base64"));
  console.log("ok", name);
}
await browser.close(); server.close();
