import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = (await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const nav = (await readFile(new URL("../src/components/site-nav.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("the sticky receipt offset measures the visible nav and re-measures after navigation", () => {
  assert.match(nav, /ref=\{mobileNavRef\}/);
  assert.match(nav, /const navs = \[navRef\.current, mobileNavRef\.current\]/);
  assert.match(nav, /Math\.max\(\.\.\.navs\.map\(\(nav\) => nav\.getBoundingClientRect\(\)\.height\)\)/);
  assert.match(nav, /if \(height > 0\)/, "a hidden nav must never set the offset to 0");
  assert.match(nav, /\}, \[pathname\]\);/, "re-measure after leaving the sign-in page");
});

test("on phones the receipt is shorter and the Survivor section matches the stub", () => {
  assert.match(css, /  \.slate-receipt-strip\.has-survivor \{ grid-template-columns: 25% 50% 25%; \}/);
  // Torn ticket: the stub and Pick'em stay the same size and sit centered.
  assert.match(css, /\.is-pickem-only \{ grid-template-columns: 33\.3333% minmax\(0, 1fr\); width: 75%; \}/);
  assert.match(css, /  \.slate-receipt-strip\.is-pickem-only \{ grid-template-columns: 25% minmax\(0, 75%\); \}/);
  assert.match(css, /  \.slate-receipt-pool \{ grid-template-rows: \.58rem 2\.75rem minmax\(\.58rem, auto\); \}/);
});

test("phone Slate chips are sized to fit their lanes", () => {
  // 2.76rem button x 1.05 draws at the 2.9rem lane, after the base chip rule so it applies.
  assert.match(css, /height: 2\.76rem; transform: translate\(-50%, -50%\) scale\(1\.05\); width: 2\.76rem;/);
  assert.match(css, /transform: translate\(-50%, -50%\) scale\(1\.007\);/);
  assert.doesNotMatch(css, /    transform: translate\(-50%, -50%\) scale\(1\.08\);/);
});
