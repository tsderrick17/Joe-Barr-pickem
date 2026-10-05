import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
const { renderEmailArtwork } = await import("../src/lib/email-artwork.tsx");
const { emailArtworkSample } = await import("../src/lib/email-artwork-sample.ts");
const { emailArtworkKinds } = await import("../src/lib/email-artwork-options.ts");

// Every outgoing email image, rendered from the fictional sample data and
// compared pixel for pixel with a committed picture. After an intended change:
//   EMAIL_BASELINE_UPDATE=1 npm test -- --test-name-pattern="email artwork baseline"
// Pictures are per platform, since fonts rasterize differently; the Linux set is
// recorded by the "Record Linux visual baselines" workflow.
const CATEGORIES = ["weekly_recap", "playoff_day_recap", "sunday_early_reveal", "sunday_late_reveal", "featured_window_reveal", "playoff_public_reveal", "weekly", "final_lines", "early_lock", "bowl_daily_recap", "bowl_line_lock"];
const folder = new URL(`./email-artwork-baselines/${process.platform === "win32" ? "win32" : "linux"}/`, import.meta.url);

async function pixels(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

test("email artwork baseline: every email image matches its committed picture", async () => {
  const update = process.env.EMAIL_BASELINE_UPDATE === "1";
  if (update) await mkdir(folder, { recursive: true });
  let checked = 0;
  for (const category of CATEGORIES) {
    const snapshot = emailArtworkSample(category);
    for (const kind of emailArtworkKinds(category, snapshot)) {
      for (const density of ["compact", "comfortable"]) {
        const response = await renderEmailArtwork(snapshot, kind, { density });
        const png = Buffer.from(await response.arrayBuffer());
        const file = new URL(`${category}-${kind}-${density}.png`, folder);
        if (update) { await writeFile(file, png); checked += 1; continue; }
        const expected = await readFile(file).catch(() => null);
        assert.ok(expected, `No baseline for ${category}/${kind}/${density}. Record it with EMAIL_BASELINE_UPDATE=1.`);
        const [a, b] = await Promise.all([pixels(png), pixels(expected)]);
        assert.equal(`${a.width}x${a.height}`, `${b.width}x${b.height}`, `${category}/${kind}/${density} changed size`);
        assert.ok(a.data.equals(b.data), `${category}/${kind}/${density} changed`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 20, `only ${checked} images covered`);
});
