import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("the Operations test coin flips exactly like a Survivor chip", async () => {
  const [css, playground] = await Promise.all([
    readStylesheet(),
    readFile(new URL("../src/components/chip-playground.tsx", import.meta.url), "utf8"),
  ]);
  const keyframes = css.match(/@keyframes survivor-chip-toss \{([\s\S]*?)\n\}/)[1];
  const fromCss = [...keyframes.matchAll(/([\d.]+)% \{ transform: translateY\(calc\(var\(--chip-rest, 0px\) \+ ([-\d.]+)px\)\) rotateZ\(calc\(var\(--toss-axis, 0deg\) \* [\d.]+\)\) rotateX\(([-\d.]+)deg\) rotateY\(([-\d.]+)deg\) scale\(([\d.]+)\); \}/g)]
    .map(([, at, lift, turn, wobble, scale]) => [Math.round(Number(at) * 100) / 10000, Number(turn) / 1080, Number(wobble), Number(lift), Number(scale)]);
  const fromPlayground = [...playground.matchAll(/\{ at: ([\d.]+), turn: ([-\d.]+) \/ 1080, wobble: ([-\d.]+), lift: ([-\d.]+), scale: ([\d.]+) \}/g)]
    .map(([, at, turn, wobble, lift, scale]) => [Number(at), Number(turn) / 1080, Number(wobble), Number(lift), Number(scale)]);
  assert.ok(fromCss.length > 20);
  assert.deepEqual(fromPlayground, fromCss);
  // Same length and linear timing (the physics is in the keyframes).
  assert.match(css, /animation: survivor-chip-toss var\(--toss-ms, 900ms\) linear both;/);
  assert.match(playground, /chip\.animate\(frames, \{ duration: 900, easing: "linear" \}\)/);
  // Steady spin through the flight: equal turns between equally spaced stops.
  const flight = fromCss.filter(([at]) => at > 0.09);
  const steps = flight.slice(1).map(([at, turn], index) => (turn - flight[index][1]) / (at - flight[index][0]));
  for (const step of steps) assert.ok(Math.abs(step - steps[0]) < 1e-2);
  // The toss ends exactly at rest: no settle, rock, or hop after the landing.
  const last = fromCss.at(-1);
  assert.deepEqual([last[1], last[2], last[3], last[4]], [1, 0, 0, 1]);
  const lifts = fromCss.filter(([at]) => at >= 0.5).map(([, , , lift]) => lift);
  for (let index = 1; index < lifts.length; index += 1) assert.ok(lifts[index] >= lifts[index - 1], "after the peak the chip only comes down");
});

test("split-flap tiles hinge in perspective and never show Graduate's dotted zero", async () => {
  const [tile, card, css] = await Promise.all([
    readFile(new URL("../src/components/bowl-score-tile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8"),
    readStylesheet(),
  ]);
  assert.match(tile, /export const tileGlyph = \(digit: number\) => \(digit === 0 \? "O" : String\(digit\)\);/);
  assert.match(tile, /rotateX\(-90deg\)/);
  assert.match(tile, /className="bowl-flap-shade"/);
  assert.match(css, /\.bowl-flap\.is-moving \{ perspective: 4\.2rem; \}/);
  assert.match(card, /<BowlScoreTile animate=\{animateScores\} landDelay=\{0\} large settled=\{bowlScoresSettled && bowlScheduleReady\}/);
  assert.match(card, /animate=\{animateScores\} landDelay=\{\(rowIndex \+ 1\) \* 90\}/);
  assert.match(card, /seasonSuffix="Special" title="BOWL CARD"/);
});

test("the Bowl Card stacks Games over remaining above the centered counter", async () => {
  const card = await readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8");
  assert.match(card, /<span className="block">Games<\/span><span className="block">remaining<\/span>/);
});

test("the Bowl Pool picks page: receipt under the menu, small Opt out, boxed team targets", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8"),
    readStylesheet(),
  ]);
  assert.match(page, /className="bowl-pool-page mx-auto max-w-6xl px-2 pb-8 pt-0 sm:px-6 sm:pb-10"/);
  assert.equal((page.match(/className=\{`bowl-pick-box /g) ?? []).length, 2);
  // Opt out sits at the top of the board, right under the instructions.
  assert.ok(page.indexOf('className="bowl-optout"') > page.indexOf("Tiebreaker is total points in Championship game."));
  assert.ok(page.indexOf('className="bowl-optout"') < page.indexOf("National Championship total points tiebreaker"));
  assert.match(css, /\.bowl-pool-page #bowl-selections \.bowl-pick-box \{[\s\S]*?min-height: 3\.1rem;/);
  assert.match(css, /grid-template-columns: 2\.6rem minmax\(0, 1fr\) 5\.45rem 1\.9rem 5\.45rem;/);
  assert.ok(page.includes("<li>Pick every bowl, including playoffs, against the spread. Participation is optional.</li><li>A game with no pick counts as a loss.</li><li>Selections lock and are revealed to others at kickoff.</li><li>Tiebreaker is total points in Championship game.</li>"));
  assert.ok(!css.includes(".bowl-pick-box .bowl-pennant { max-width: 100%; width: 100%; }"));
});

test("each Survivor chip toss varies its spin axis and speed; the test coin does not", async () => {
  const [chip, css, playground] = await Promise.all([
    readFile(new URL("../src/components/survivor-poker-chip.tsx", import.meta.url), "utf8"),
    readStylesheet(),
    readFile(new URL("../src/components/chip-playground.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chip, /"--toss-axis": `\$\{lean\.toFixed\(1\)\}deg`, "--toss-ms": `\$\{Math\.round\(between\(780, 1060\)\)\}ms`/);
  assert.match(chip, /useState\(\(\) => \(animate \? randomToss\(\) : undefined\)\)/);
  // The tilt always returns to zero by the end, so the chip lands exactly upright.
  const keyframes = css.match(/@keyframes survivor-chip-toss \{([\s\S]*?)\n\}/)[1];
  assert.match(keyframes.split("\n").filter(Boolean).at(-1), /^\s*100% \{.*rotateZ\(calc\(var\(--toss-axis, 0deg\) \* 0\.0\)\)/);
  assert.ok(!playground.includes("--toss-axis") && !playground.includes("Math.random"));
});

test("the Pick'em Pad keeps its own layer through the turn so the marks don't redraw at the end", async () => {
  const css = await readStylesheet();
  assert.match(css, /\.pad-flip-inner \{[^}]*will-change: transform;/);
});
