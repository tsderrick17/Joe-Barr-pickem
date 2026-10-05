import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("desktop Bowl Card viewport fits eight complete game columns", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const page = fs.readFileSync(path.join(root, "src/components/bowl-card.tsx"), "utf8");
  assert.match(css, /\.bowl-standings-scroll\s*\{[\s\S]*width: min\(100%, 74\.5rem\)/);
  assert.match(css, /\.bowl-card-section:not\(\.is-minimized\)[\s\S]*width: min\(74\.5rem, calc\(100vw - 2rem\)\)/);
  assert.match(page, /bowlGames\.length\} \* var\(--bowl-game-width, 7\.5rem\)/);
});

test("Bowl Card uses a gold theme and keeps the standard heading rule", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const bowl = css.slice(css.indexOf("Bowl Pool identity"), css.indexOf(".bowl-card-section.is-minimized {"));
  // The heading line is the shared ledger rule, never a Bowl-specific color.
  assert.doesNotMatch(bowl, /\.bowl-card-section \.pickem-ledger-masthead[^{]*\{[^}]*border-top-color/);
  // No teal or mint left in the Bowl Pool treatment.
  assert.doesNotMatch(bowl, /#0f766e|#155e59|#e8f3f0|#b9cfc8|#55b8aa/i);
  // The scoreboard header (dates, games, lines) is navy; the old gold header fill is gone.
  assert.doesNotMatch(css, /#8a6a1d/);
  assert.match(css, /\.bowl-card-section \.bowl-standings-scroll > div > \.grid:first-child span:not\(\[aria-hidden\]\) \{\s*background: var\(--bowl-navy\) !important;/);
});

test("Bowl games-remaining counter is a larger split-flap tile; lines use the Bowl Pool's navy and old gold", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.match(css, /\.bowl-score-tile\.is-large \.bowl-flap \{ height: 2\.9rem; width: 1\.8rem; \}/);
  assert.match(css, /\.bowl-standings-line \{ color: var\(--bowl-gold-soft\) !important;/);
});
