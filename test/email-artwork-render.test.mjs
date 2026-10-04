import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const { renderEmailArtwork } = await import("../src/lib/email-artwork.tsx");
const { emailArtworkSample } = await import("../src/lib/email-artwork-sample.ts");
const { emailArtworkKinds } = await import("../src/lib/email-artwork-options.ts");

async function render(snapshot, kind, density = "compact") {
  const response = await renderEmailArtwork(snapshot, kind, { density });
  const png = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(png).metadata();
  // The bottom padding is deliberate and small. Check the actual pixels to
  // prevent a large blank tail from returning even if sizing code changes.
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lastInk = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const p = (y * info.width + x) * info.channels;
      if (data[p] < 160 && data[p + 1] < 160 && data[p + 2] < 160) { lastInk = y; break; }
    }
  }
  assert.ok(info.height - lastInk < 50, `${kind}: blank tail is ${info.height - lastInk}px`);
  assert.equal(metadata.width, 760);
  if (process.env.EMAIL_ARTWORK_CAPTURE === "1") {
    await mkdir("test-results/email-artwork", { recursive: true });
    await writeFile(`test-results/email-artwork/${snapshot.kind}-${kind}-${density}.png`, png);
  }
  return metadata;
}

test("every outgoing artwork is content-fitted, including short slates and Survivor", async () => {
  for (const category of ["weekly_recap", "playoff_day_recap", "sunday_early_reveal", "sunday_late_reveal", "featured_window_reveal", "playoff_public_reveal", "weekly", "final_lines", "early_lock", "bowl_daily_recap", "bowl_line_lock"]) {
    const snapshot = emailArtworkSample(category);
    for (const kind of emailArtworkKinds(category, snapshot)) await render(snapshot, kind);
  }
});

test("recap combines standings and selections without two stacked rosters", async () => {
  const snapshot = emailArtworkSample("weekly_recap");
  const compact = await render(snapshot, "summary");
  assert.ok(compact.height < 900, `11-player recap too tall: ${compact.height}`);
  const comfortable = await render(snapshot, "summary", "comfortable");
  assert.ok(comfortable.height > compact.height);
});

test("long playoff selections and large rosters grow instead of clipping", async () => {
  const snapshot = emailArtworkSample("playoff_day_recap");
  snapshot.standings = Array.from({ length: 40 }, (_, i) => ({ name: `Player ${i + 1}`, wins: 40 - i }));
  snapshot.weeklySummary = snapshot.standings.map((item) => ({ ...item, wins: 3, picks: ["BUF W", "SEA L", "NE W", "PHI L", "DAL W", "HOU L"] }));
  const result = await render(snapshot, "summary");
  assert.ok(result.height > 40 * 70);
});

test("email images are palette PNGs, small enough to load quickly on a phone", async () => {
  for (const [category, kinds] of [["weekly_recap", ["summary", "survivor"]], ["weekly", ["fresh"]], ["final_lines", ["gameday"]], ["bowl_daily_recap", ["bowl"]]]) {
    const snapshot = emailArtworkSample(category);
    if (!snapshot) continue;
    for (const kind of kinds) {
      const response = await renderEmailArtwork(snapshot, kind, { density: "compact" });
      const png = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(png).metadata();
      assert.equal(metadata.paletteBitDepth !== undefined || metadata.isPalette === true, true, `${kind}: expected a palette PNG`);
      // Full-color RGBA was 34-74 KB for these; the palette keeps each well under 30 KB.
      assert.ok(png.length < 30_000, `${kind}: ${png.length} bytes`);
      // Text and chips stay crisp: a palette this size must not collapse to a handful of colors.
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const colors = new Set();
      for (let i = 0; i < data.length; i += info.channels) colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      assert.ok(colors.size > 8, `${kind}: only ${colors.size} colors`);
    }
  }
});

test("Sunday and featured reveals add a Survivor section for started games in the same image", async () => {
  const withSurvivor = emailArtworkSample("sunday_early_reveal");
  const without = { ...withSurvivor, survivor: undefined };
  const a = await render(withSurvivor, "reveal");
  const b = await render(without, "reveal");
  // Two lines of three Survivor picks plus the section heading.
  assert.ok(a.height - b.height > 80, `Survivor section adds only ${a.height - b.height}px`);
  // Older saved receipts have no Survivor field and render as before.
  assert.equal((await render(emailArtworkSample("sunday_early_reveal", true), "reveal")).height, b.height);
  await render(emailArtworkSample("featured_window_reveal"), "reveal");
});
