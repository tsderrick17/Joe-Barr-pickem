import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Bowl picks legend stacks its labels and kickoff times use A or P", async () => {
  const page = await readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("<span>Date<br />Time</span><span>Bowl<br />Location</span>"));
  assert.ok(page.includes('.replace(/\\s?AM$/i, "A").replace(/\\s?PM$/i, "P")'));
  assert.ok(!page.includes("Date / time"));
});

test("the Bowl receipt frame is what sticks, so it stays in view for the whole schedule", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.bowl-pool-page \.bowl-receipt-frame \{ position: sticky; top: var\(--site-nav-height, 0px\); z-index: 40; \}/);
});

test("Fav, Line and Dog are vertically centered in the legend bar", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /#bowl-selections > div\.overflow-hidden > div:first-child \{ align-items: center; \}/);
});
