import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const nav = (await readFile(new URL("../src/components/site-nav.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("the sticky receipt offset measures the visible nav and re-measures after navigation", () => {
  assert.match(nav, /ref=\{mobileNavRef\}/);
  assert.match(nav, /const navs = \[navRef\.current, mobileNavRef\.current\]/);
  assert.match(nav, /Math\.max\(\.\.\.navs\.map\(\(nav\) => nav\.getBoundingClientRect\(\)\.height\)\)/);
  assert.match(nav, /if \(height > 0\)/, "a hidden nav must never set the offset to 0");
  assert.match(nav, /\}, \[pathname\]\);/, "re-measure after leaving the sign-in page");
});
