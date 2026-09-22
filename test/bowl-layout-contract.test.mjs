import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("desktop Bowl Card viewport fits eight complete game columns", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  assert.match(css, /\.bowl-standings-scroll\s*\{[\s\S]*width: min\(100%, 74\.5rem\)/);
  assert.match(css, /\.bowl-card-section:not\(\.is-minimized\)[\s\S]*width: min\(74\.5rem, calc\(100vw - 2rem\)\)/);
  assert.match(page, /bowlGames\.length \* 7\.5/);
});
