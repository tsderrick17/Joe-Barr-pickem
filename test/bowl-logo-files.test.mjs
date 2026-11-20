import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BOWL_PENNANTS } from "../src/lib/bowl-logos.js";

// Every bowl logo is fitted by scripts/fit-bowl-logos.mjs: one canvas the shape of the pennant's logo box, clear round the logo (no
// square of white or black behind it), so every logo flies the same size.
const DIR = new URL("../public/bowl-logos/", import.meta.url);
const files = readdirSync(DIR).filter((file) => file.endsWith(".webp"));

test("every bowl logo is on the standard 192 x 92 clear canvas, and every pennant's logo file exists", async () => {
  for (const file of files) {
    const image = sharp(fileURLToPath(new URL(file, DIR)));
    const { width, height, hasAlpha } = await image.metadata();
    assert.deepEqual({ file, width, height, hasAlpha }, { file, width: 192, height: 92, hasAlpha: true });
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [191, 0], [0, 91], [191, 91]]) assert.equal(alphaAt(x, y), 0, `${file} has a solid corner`);
  }
  for (const { logo } of BOWL_PENNANTS) assert.ok(files.includes(`${logo}.webp`), `${logo}.webp is missing`);
});
