import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Operations test coin flips exactly like a Survivor chip", async () => {
  const [css, playground] = await Promise.all([
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chip-playground.tsx", import.meta.url), "utf8"),
  ]);
  const keyframes = css.match(/@keyframes survivor-chip-toss \{([\s\S]*?)\n\}/)[1];
  const fromCss = [...keyframes.matchAll(/([\d.]+)% \{ transform: translateY\(([-\d.]+)px\) rotateX\(([-\d.]+)deg\) rotateY\(([-\d.]+)deg\) scale\(([\d.]+)\); \}/g)]
    .map(([, at, lift, turn, wobble, scale]) => [Number(at) / 100, Number(turn) / 1080, Number(wobble), Number(lift), Number(scale)]);
  const fromPlayground = [...playground.matchAll(/\{ at: ([\d.]+), turn: ([-\d.]+) \/ 1080, wobble: ([-\d.]+), lift: ([-\d.]+), scale: ([\d.]+) \}/g)]
    .map(([, at, turn, wobble, lift, scale]) => [Number(at), Number(turn) / 1080, Number(wobble), Number(lift), Number(scale)]);
  assert.ok(fromCss.length > 20);
  assert.deepEqual(fromPlayground, fromCss);
  // Same length and linear timing (the physics is in the keyframes).
  assert.match(css, /animation: survivor-chip-toss 900ms linear both;/);
  assert.match(playground, /chip\.animate\(frames, \{ duration: 900, easing: "linear" \}\)/);
  // Steady spin through the flight: equal turns between equally spaced stops.
  const flight = fromCss.filter(([at]) => at > 0.06 && at <= 0.86);
  const steps = flight.slice(1).map(([at, turn], index) => (turn - flight[index][1]) / (at - flight[index][0]));
  for (const step of steps) assert.ok(Math.abs(step - steps[0]) < 1e-6);
});

test("split-flap tiles hinge in perspective and never show Graduate's dotted zero", async () => {
  const [tile, card, css] = await Promise.all([
    readFile(new URL("../src/components/bowl-score-tile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(tile, /export const tileGlyph = \(digit: number\) => \(digit === 0 \? "O" : String\(digit\)\);/);
  assert.match(tile, /rotateX\(-90deg\)/);
  assert.match(tile, /className="bowl-flap-shade"/);
  assert.match(css, /\.bowl-flap\.is-moving \{ perspective: 4\.2rem; \}/);
  assert.match(card, /\{digit === "0" \? "O" : digit\}/);
  assert.match(card, /seasonSuffix="Special" title="BOWL CARD"/);
});

test("the Bowl Card stacks Games over remaining above the centered counter", async () => {
  const card = await readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8");
  assert.match(card, /<span className="block">Games<\/span><span className="block">remaining<\/span>/);
});

test("the Bowl Pool picks page: receipt under the menu, small Opt out, boxed team targets", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /className="bowl-pool-page mx-auto max-w-6xl px-2 pb-8 pt-0 sm:px-6 sm:pb-10"/);
  assert.equal((page.match(/className=\{`bowl-pick-box /g) ?? []).length, 2);
  // Opt out sits at the foot of the board, not on its own line above it.
  assert.ok(page.indexOf('className="bowl-optout"') > page.indexOf("National Championship total points tiebreaker"));
  assert.match(css, /\.bowl-pool-page #bowl-selections \.bowl-pick-box \{[\s\S]*?min-height: 3\.1rem;/);
  assert.match(css, /grid-template-columns: 2\.6rem minmax\(0, 1fr\) 5\.1rem 2\.6rem 5\.1rem;/);
});
