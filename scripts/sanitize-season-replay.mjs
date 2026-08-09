import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { replaySeasonStructure, sanitizeSeasonReplay } from "../test/support/season-certification.mjs";

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument || !outputArgument) {
  throw new Error("Usage: npm run season:replay:sanitize -- <raw-events.json> <sanitized-events.json>");
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const clean = sanitizeSeasonReplay(raw);
const finalGames = replaySeasonStructure(clean);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(clean, null, 2)}\n`);
console.log(JSON.stringify({
  inputEvents: raw.length,
  sanitizedEvents: clean.length,
  replayedGames: finalGames.length,
  outputPath,
}, null, 2));

