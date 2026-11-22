// Fetches the current logos and saves any that changed, so a renamed or redesigned bowl or NFL team never flies an old logo.
// Run by .github/workflows/logo-refresh.yml (bowls: the Friday two days before Selection Sunday; NFL: July 31), which pushes a
// branch and opens an issue when anything changed. Nothing goes live until the Commissioner merges it.
//   node scripts/refresh-logos.mjs bowl     every bowl's logo from its Wikipedia article (the infobox image), refitted by fit-bowl-logos
//   node scripts/refresh-logos.mjs nfl      all 32 NFL logos from ESPN (500 x 500), remeasured by measure-team-logos
// Writes a short Markdown summary of what changed to the file named by LOGO_SUMMARY (when set). A logo that cannot be fetched keeps
// the one already saved and is listed in the summary as not checked.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BOWL_ARTICLES } from "./bowl-logo-articles.mjs";

const root = new URL("../", import.meta.url);
const AGENT = "JoeBarrPickemLogoRefresh/1.0 (https://github.com/tsderrick17/Joe-Barr-pickem)";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** ESPN's own abbreviation where it differs from ours (ESPN writes Washington as WSH). */
export const ESPN_NFL = { WAS: "wsh" };

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": AGENT } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429 && response.status < 500) throw new Error(`${response.status} from ${url}`);
    await pause(5000 * (attempt + 1));
  }
  throw new Error(`no answer from ${url}`);
}

async function samePicture(a, b) {
  const [x, y] = await Promise.all([a, b].map((image) => sharp(image).ensureAlpha().resize(200, 200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer()));
  let off = 0;
  for (let i = 0; i < x.length; i += 1) off += Math.abs(x[i] - y[i]);
  return off / x.length < 2;
}

async function refreshBowls() {
  const folder = new URL("assets/bowl-logos/", root);
  const saved = readdirSync(folder);
  const changed = [], missed = [];
  for (const [name, article] of Object.entries(BOWL_ARTICLES)) {
    try {
      const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(article)}`;
      const page = Object.values(JSON.parse((await get(api)).toString("utf8")).query?.pages ?? {})[0];
      const source = page?.original?.source;
      if (!source) throw new Error("no infobox image");
      await pause(1500);
      const image = await get(source);
      const extension = (source.match(/\.(svg|png|webp|jpe?g)$/i)?.[1] ?? "png").toLowerCase().replace("jpeg", "jpg");
      const old = saved.find((file) => file.replace(/\.\w+$/, "") === name);
      const oldBytes = old ? readFileSync(new URL(old, folder)) : null;
      if (oldBytes && (oldBytes.equals(image) || (extension !== "svg" && !old.endsWith(".svg") && await samePicture(oldBytes, image)))) continue;
      if (old) rmSync(new URL(old, folder));
      writeFileSync(new URL(`${name}.${extension}`, folder), image);
      changed.push(`${name} (${page.title})`);
      execFileSync(process.execPath, [fileURLToPath(new URL("scripts/fit-bowl-logos.mjs", root)), name], { stdio: "inherit" });
    } catch (error) {
      missed.push(`${name} (${article}): ${error.message}`);
    }
    await pause(1500);
  }
  return { changed, missed };
}

async function refreshNfl() {
  const folder = new URL("public/team-logos/", root);
  const changed = [], missed = [];
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".png"))) {
    const team = file.replace(".png", "");
    try {
      const image = await get(`https://a.espncdn.com/i/teamlogos/nfl/500/${ESPN_NFL[team] ?? team.toLowerCase()}.png`);
      const fresh = await sharp(image).resize(500, 500, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      if (await samePicture(readFileSync(new URL(file, folder)), fresh)) continue;
      writeFileSync(new URL(file, folder), fresh);
      changed.push(team);
    } catch (error) {
      missed.push(`${team}: ${error.message}`);
    }
    await pause(500);
  }
  if (changed.length) execFileSync(process.execPath, [fileURLToPath(new URL("scripts/measure-team-logos.mjs", root))], { stdio: "inherit" });
  return { changed, missed };
}

const kind = process.argv[2];
if (kind !== "bowl" && kind !== "nfl") throw new Error("Say which logos: bowl or nfl.");
const { changed, missed } = kind === "bowl" ? await refreshBowls() : await refreshNfl();
const label = kind === "bowl" ? "Bowl" : "NFL";
const summary = [
  changed.length ? `**${label} logos that changed (${changed.length}):**` : `No ${label} logo changed.`,
  ...changed.map((item) => `- ${item}`),
  ...(missed.length ? ["", `**Not checked (the saved logo stays):**`, ...missed.map((item) => `- ${item}`)] : []),
].join("\n");
console.log(summary);
if (process.env.LOGO_SUMMARY) writeFileSync(process.env.LOGO_SUMMARY, summary);
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.length}\nmissed=${missed.length}\n`, { flag: "a" });
