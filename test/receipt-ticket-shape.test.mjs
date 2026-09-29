import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const rule = (selector, tail = " {") => {
  const start = css.indexOf(`\n${selector}${tail}`) + 1;
  assert.ok(start >= 1, `missing rule: ${selector}`);
  return css.slice(start, css.indexOf("\n}", start));
};

test("each receipt section paints its paper on a masked layer, so cutouts are real and content is never clipped", () => {
  const layer = rule(".slate-receipt-ticket::before,\n.slate-receipt-pool::before");
  assert.match(layer, /background: var\(--receipt-paper\);/);
  assert.match(layer, /position: absolute;/);
  assert.match(layer, /z-index: -1;/);
  assert.match(layer, /pointer-events: none;/);
  assert.match(layer, /mask-composite: intersect;/);
  assert.match(layer, /-webkit-mask-composite: source-in;/);
  // The section itself is never masked, so tooltips and focus rings can overflow it.
  for (const selector of [".slate-receipt-ticket", ".slate-receipt-pool"]) {
    assert.doesNotMatch(css.slice(css.indexOf(`\n${selector} {`)).split("\n}")[0] ?? "", /\bmask/);
  }
});

test("the stub has a serrated left end and round notches on the first perforation", () => {
  const stub = rule(".slate-receipt-ticket::before");
  assert.match(stub, /mask-image: var\(--receipt-bite-serrated-left\), var\(--receipt-bite-top-right\), var\(--receipt-bite-bottom-right\);/);
  assert.match(stub, /mask-repeat: repeat-y, no-repeat, no-repeat;/);
});

test("a middle section is notched on both perforations", () => {
  const marker = css.indexOf("/* Middle section with Survivor beside it");
  assert.ok(marker > 0, "middle-section rule is documented");
  const middle = css.slice(marker, css.indexOf("\n}", marker));
  assert.match(middle, /mask-image: var\(--receipt-bite-top-left\), var\(--receipt-bite-bottom-left\), var\(--receipt-bite-top-right\), var\(--receipt-bite-bottom-right\);/);
});

test("whichever section ends the ticket takes the serrated end, so tearing Survivor off leaves the same edge", () => {
  const last = rule(".slate-receipt-strip.is-pickem-only .slate-receipt-pool::before,\n.slate-receipt-pool.slate-receipt-survivor::before");
  assert.match(last, /mask-image: var\(--receipt-bite-top-left\), var\(--receipt-bite-bottom-left\), var\(--receipt-bite-serrated-right\);/);
  assert.match(last, /mask-repeat: no-repeat, no-repeat, repeat-y;/);
});

test("notch and scallop bites are true half and quarter circles that shrink on phones", () => {
  const strip = rule(".slate-receipt-strip {\n  --receipt-notch", "");
  for (const [name, at] of [["top-left", "0 0"], ["bottom-left", "0 100%"], ["top-right", "100% 0"], ["bottom-right", "100% 100%"]]) {
    assert.ok(strip.includes(`--receipt-bite-${name}: radial-gradient(circle at ${at}, transparent var(--receipt-notch)`), `notch ${name}`);
  }
  assert.match(strip, /--receipt-bite-serrated-left: radial-gradient\(circle at 0 50%, transparent var\(--receipt-scallop\)/);
  assert.match(strip, /--receipt-bite-serrated-right: radial-gradient\(circle at 100% 50%, transparent var\(--receipt-scallop\)/);
  assert.match(css, /@media \(max-width: 639px\) \{\n  \.slate-receipt-strip \{ --receipt-notch: \.34rem; --receipt-scallop: \.13rem; \}/);
});

test("the strip is transparent so the scrolling page shows through, and its shadow follows the outline", () => {
  const strip = rule(".slate-mini-nav.slate-receipt-strip");
  assert.match(strip, /background: transparent !important;/);
  assert.match(strip, /box-shadow: none !important;/);
  const base = rule(".slate-receipt-strip {\n  --receipt-paper", "");
  assert.match(base, /filter: drop-shadow\(0 0 \.5px var\(--receipt-rule\)\) var\(--receipt-shadow\);/);
  assert.doesNotMatch(base, /box-shadow|background:|border-(top|bottom):/);
  const night = rule('html[data-theme="night"] .slate-receipt-strip');
  assert.match(night, /--receipt-shadow: drop-shadow\(/);
  assert.doesNotMatch(night, /box-shadow/);
});

test("the perforation is a dashed line that runs between its two notches", () => {
  const perforation = rule(".slate-receipt-pool::after");
  assert.match(perforation, /border-left: 1px dashed var\(--receipt-rule\);/);
  assert.match(perforation, /top: var\(--receipt-notch\);/);
  assert.match(perforation, /bottom: var\(--receipt-notch\);/);
  assert.doesNotMatch(css, /\.slate-receipt-pool \{ border-left: 1px dashed/);
});
