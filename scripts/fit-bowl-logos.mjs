// Sets every bowl logo in public/bowl-logos/ to one standard size for the Bowl ticket's pennants, the way every NFL team's logo
// reads the same size on the Survivor board: each logo is trimmed to its own edges, then scaled so it covers the same area as
// every other (a tall shield and a wide wordmark look equally big), never past the pennant's logo box, and centred on a clear
// canvas the shape of that box (192 x 92, twice the 96 x 46 the pennant draws it at). Safe to re-run; new logos are fitted the same way.
//   node scripts/fit-bowl-logos.mjs [name ...]      (no names: every logo)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = new URL("../public/bowl-logos/", import.meta.url);
const BOX = { width: 192, height: 92 };
const AREA = 8600;   // the area every logo covers on that canvas: about a 93 x 93 square

const names = process.argv.slice(2);
const files = names.length ? names.map((name) => `${name}.webp`) : readdirSync(DIR).filter((file) => file.endsWith(".webp"));

for (const file of files) {
  const path = fileURLToPath(new URL(file, DIR));
  const trimmed = await sharp(readFileSync(path)).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const ratio = width / height;
  let fitWidth = Math.sqrt(AREA * ratio);
  let fitHeight = fitWidth / ratio;
  const shrink = Math.min(1, BOX.width / fitWidth, BOX.height / fitHeight);
  fitWidth = Math.round(fitWidth * shrink);
  fitHeight = Math.round(fitHeight * shrink);
  const logo = await sharp(trimmed.data).resize(fitWidth, fitHeight).png().toBuffer();
  const output = await sharp({ create: { ...BOX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: Math.round((BOX.width - fitWidth) / 2), top: Math.round((BOX.height - fitHeight) / 2) }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  writeFileSync(path, output);
  console.log(`${file}: ${width} x ${height} -> ${fitWidth} x ${fitHeight}`);
}
