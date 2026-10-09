import type { CSSProperties } from "react";

/** How far a highlighter stroke may wander: sideways and up/down (em) and a slight turn (deg). */
export type StrokeJitterAmount = { x: number; y: number; turn: number };
export const STROKE_JITTER_DEFAULTS: StrokeJitterAmount = { x: 0.06, y: 0.035, turn: 0.45 };

/** A fresh, barely-there wobble for each highlighter stroke. Seeded from the team and
 *  the click, so it stays put on re-render but changes the next time it is marked. */
export function strokeJitter(seed: string, amount: StrokeJitterAmount = STROKE_JITTER_DEFAULTS): CSSProperties {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  const unit = (shift: number) => (((hash >>> shift) & 255) / 255) * 2 - 1;
  return {
    "--ink-x": `${(unit(0) * amount.x).toFixed(3)}em`,
    "--ink-y": `${(unit(8) * amount.y).toFixed(3)}em`,
    "--ink-turn": `${(unit(16) * amount.turn).toFixed(2)}deg`,
  } as CSSProperties;
}
