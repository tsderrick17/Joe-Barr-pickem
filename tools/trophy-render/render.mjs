// Renders one trophy scene to a PNG using headless Chromium's software WebGL.
// Usage: node render.mjs <scene> [width] [height] [out]       scenes: test | pickem | survivor | bowl | marble
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { startServer } from "./serve.mjs";
import { fileURLToPath } from "node:url";

const [scene = "test", width = "1400", height = "1700", out] = process.argv.slice(2);
const server = await startServer(5599);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("console", (message) => { if (["error", "warning"].includes(message.type())) console.log("[page]", message.text().slice(0, 300)); });
page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 400)));
const started = Date.now();
await page.goto(`http://localhost:5599/scene.html?scene=${scene}&w=${width}&h=${height}${process.env.PLAQUES === "0" ? "&plaques=0" : ""}${process.env.ROT ? `&rot=${process.env.ROT}` : ""}${process.env.CHAMPIONS ? `&champions=${encodeURIComponent(process.env.CHAMPIONS)}` : ""}`);
await page.waitForFunction(() => window.__done === true || window.__error, undefined, { timeout: 600_000, polling: 500 });
const error = await page.evaluate(() => window.__error);
if (error) { console.log("RENDER ERROR", error); await browser.close(); server.close(); process.exit(1); }
const data = await page.evaluate(() => window.__png);
mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
const file = out ?? fileURLToPath(new URL(`./out/${scene}.png`, import.meta.url));
writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
{ const slots = await page.evaluate(() => window.__slots); writeFileSync(file.replace(/\.png$/, ".slots.json"), JSON.stringify(slots)); }
console.log("rendered", scene, `${Math.round((Date.now() - started) / 1000)}s`, file);
await browser.close(); server.close();
