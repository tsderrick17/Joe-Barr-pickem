import type { CSSProperties } from "react";

/** How far a highlighter stroke may wander: sideways and up/down (em) and a slight turn (deg). */
export type StrokeJitterAmount = { x: number; y: number; turn: number };
export const STROKE_JITTER_DEFAULTS: StrokeJitterAmount = { x: 0.2, y: 0.2, turn: 2 };

/** A fresh wobble for each highlighter stroke, anywhere within the amounts above (either way). Seeded from the team
 *  and the click, so it stays put on re-render but is a different position every time it is marked. */
export function strokeJitter(seed: string, amount: StrokeJitterAmount = STROKE_JITTER_DEFAULTS): CSSProperties {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  // Each of the three offsets gets its own fully mixed draw, so neighbouring clicks never look alike.
  const unit = (salt: number) => {
    let mixed = Math.imul(hash ^ salt, 0x85ebca6b);
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 0xc2b2ae35);
    mixed ^= mixed >>> 16;
    return (mixed >>> 0) / 4294967295 * 2 - 1;
  };
  return {
    "--ink-x": `${(unit(0x9e3779b1) * amount.x).toFixed(3)}em`,
    "--ink-y": `${(unit(0x7f4a7c15) * amount.y).toFixed(3)}em`,
    "--ink-turn": `${(unit(0x1b873593) * amount.turn).toFixed(2)}deg`,
  } as CSSProperties;
}
