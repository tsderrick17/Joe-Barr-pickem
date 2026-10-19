import { useId, type CSSProperties, type ReactNode } from "react";
import { bowlPennantColors, bowlSeasonLabel } from "@/lib/bowl-pennant.js";
import { bowlTeamName } from "@/lib/bowl-pool.js";

type PennantTeam = { full_name?: string; short_name?: string | null; abbreviation?: string | null; primary_color?: string | null; secondary_color?: string | null } | null | undefined;

/** The name split over at most two lines at a word break, as evenly as it goes (a lone long word stays whole and is squeezed to fit). */
function nameLines(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2 || name.length <= 9) return [name];
  let best = [name], bestWidth = Infinity;
  for (let cut = 1; cut < words.length; cut++) {
    const lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")], width = Math.max(...lines.map((line) => line.length));
    if (width < bestWidth) { best = lines; bestWidth = width; }
  }
  return best;
}

/** The cone's half-height at x (it widens in a straight line from the mouthpiece to the bell) and an arc across it that bows toward the mouthpiece. */
const half = (x: number) => 4.2 + ((x - 14) / 78) * 16.8;
const across = (x: number) => ({ top: 23.5 - half(x), bottom: 23.5 + half(x), rx: half(x) * 0.31, ry: half(x) });
const BAND = (() => { const a = across(77), b = across(83.5); return `M77 ${a.top}A${a.rx} ${a.ry} 0 0 0 77 ${a.bottom}L83.5 ${b.bottom}A${b.rx} ${b.ry} 0 0 1 83.5 ${b.top}Z`; })();

/**
 * The school's name as if printed on the cone. Each line runs along a line of the cone, so a line off the axis tilts to follow the cone's edge (lines
 * converge toward the mouthpiece), and the letters grow toward the bell as the cone widens. Each letter is placed and rotated on its own.
 */
const APEX = -5.5;            // where the cone's edges would meet, left of the mouthpiece
const REF = 50;               // the lettering is centred on this x
const WIDTH: Record<string, number> = { I: 0.55, J: 0.75, L: 0.92, T: 0.96, F: 0.94, E: 0.96, M: 1.32, W: 1.42, "'": 0.4, ".": 0.4, "-": 0.7, "&": 1.1 };
function printedLetters(lines: string[]) {
  const reach = REF - APEX, limit = lines.length > 1 ? 29 : 34, damp = 0.7, unit = 6;
  return lines.flatMap((line, row) => {
    const offset = lines.length > 1 ? (row ? 4.7 : -4.7) : 0, angle = Math.atan2(offset, reach), r0 = reach / Math.cos(angle);
    const chars = [...line], grow = (r: number) => 1 + damp * (r / r0 - 1), weight = (char: string) => WIDTH[char] ?? 1;
    const natural = chars.reduce((sum, char) => sum + unit * weight(char), 0), target = Math.min(limit, natural);
    let k = 1, centers: number[] = [];
    for (let pass = 0; pass < 5; pass++) {          // k shrinks letters and their spacing together until the word fits the span (a short word is never stretched)
      centers = []; let r = r0 - target / 2;
      for (const char of chars) { const step = unit * weight(char) * k * grow(r + (unit * weight(char) * k) / 2); centers.push(r + step / 2); r += step; }
      k *= target / (r - (r0 - target / 2));
    }
    const shift = r0 - (centers[0] + centers[centers.length - 1]) / 2;
    return chars.map((char, i) => { const r = centers[i] + shift; return { char, key: `${row}-${i}`, x: APEX + r * Math.cos(angle), y: 24 + r * Math.sin(angle), degrees: (angle * 180) / Math.PI, scale: Math.min(1.2, grow(r) * k) }; });
  });
}

/** The cone's outline: a short narrow tube that flares in a gentle curve to a wide bell (its top edge, then the bell's far edge, then the bottom edge back). */
const CONE = "M9 19.3H14L92 2.5V44.5L14 27.7H9Z";

/**
 * A cheerleader's megaphone in a school's own colors, lettered with its name: a short narrow mouthpiece ending in a rounded, swollen lip, a
 * stout cone that flares to a wide bell with a dark inside, a band near the bell and a small handle underneath. When a team is picked it
 * swings up and gives a cheer (three little sound arcs by the bell). The same size for every school. Decorative: the pick itself is announced by
 * the button's pressed state.
 */
export function BowlMegaphone({ team, side }: { team: PennantTeam; side: "left" | "right" }) {
  const colors = bowlPennantColors(team);
  const lines = nameLines(bowlTeamName(team).toUpperCase());
  const cone = useId().replaceAll(":", "");
  return (
    <span
      aria-hidden="true"
      className={`bowl-megaphone is-${side}`}
      style={{ "--megaphone-primary": colors.primary, "--megaphone-secondary": colors.secondary, "--megaphone-ink": colors.ink } as CSSProperties}
    >
      <svg focusable="false" viewBox="0 0 120 47">
        <defs>
          <clipPath id={cone}><path d={CONE} /></clipPath>
          <linearGradient id={`${cone}-shade`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".26" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".24" /></linearGradient>
          <linearGradient id={`${cone}-inside`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".72" /><stop offset=".6" stopColor="#000" stopOpacity=".5" /><stop offset="1" stopColor="#000" stopOpacity=".3" /></linearGradient>
        </defs>
        <g className="bowl-megaphone-waves">
          <path d="M101.5 13Q107.5 23.5 101.5 34" /><path d="M105.5 8.5Q113.5 23.5 105.5 38.5" /><path d="M109.5 4Q119.5 23.5 109.5 43" />
        </g>
        <g className="bowl-megaphone-art">
          <path className="bowl-megaphone-handle-edge" d="M30 29.8V36.5Q30 40.5 34 40.5H42Q46 40.5 46 36.5V33.4" />
          <path className="bowl-megaphone-handle" d="M30 29.8V36.5Q30 40.5 34 40.5H42Q46 40.5 46 36.5V33.4" />
          <path className="bowl-megaphone-body" d={CONE} />
          <g className="bowl-megaphone-print">
            {printedLetters(lines).map((letter) => <text className="bowl-megaphone-name" key={letter.key} transform={`translate(${letter.x.toFixed(2)} ${letter.y.toFixed(2)}) rotate(${letter.degrees.toFixed(2)}) scale(${letter.scale.toFixed(3)})`}>{letter.char}</text>)}
          </g>
          <g clipPath={`url(#${cone})`}>
            <rect fill={`url(#${cone}-shade)`} height="47" width="100" x="6" y="0" />
            <path className="bowl-megaphone-trim" d={BAND} />
          </g>
          <path className="bowl-megaphone-edge" d={CONE} />
          <ellipse className="bowl-megaphone-body" cx="92" cy="23.5" rx="6.5" ry="21" />
          <ellipse fill={`url(#${cone}-inside)`} cx="92" cy="23.5" rx="6.5" ry="21" />
          <ellipse className="bowl-megaphone-hole" cx="90.4" cy="23.5" rx="4.5" ry="18" />
          <ellipse className="bowl-megaphone-rim" cx="92" cy="23.5" rx="6.5" ry="21" />
          <rect className="bowl-megaphone-lip" height="15.6" rx="3.5" width="7" x="3" y="15.7" />
        </g>
      </svg>
    </span>
  );
}

/** The Bowl Pool's heading: gold rules, three stars, the title in varsity lettering, and the season. */
export function BowlCrest({ action, seasonYear, title, seasonSuffix }: { action?: ReactNode; seasonYear: number; title: string; seasonSuffix?: string }) {
  return (
    <div className="bowl-crest">
      <div className="bowl-crest-ornament" aria-hidden="true"><span /><i>★ ★ ★</i><span /></div>
      <div className="bowl-crest-title"><h2>{title}</h2>{action}</div>
      <p className="bowl-crest-season">{bowlSeasonLabel(seasonYear)}{seasonSuffix ? ` ${seasonSuffix}` : ""}</p>
    </div>
  );
}

/** Joining the pool is a ticket you claim; claiming it brings the whole card in. */
export function BowlClaimSeat({ busy, onClaim }: { busy?: boolean; onClaim: () => void }) {
  return (
    <section aria-label="Join the Bowl Pool" className="bowl-claim">
      <div className="bowl-claim-main">
        <p className="bowl-claim-kicker">ADMIT ONE · BOWL SEASON</p>
        <h3>Claim your seat in the Bowl Pool</h3>
        <p>Pick every bowl against the spread, from the first kickoff through the title game. Separate from Pick&apos;em and Survivor.</p>
        <p className="bowl-claim-note">You may opt out at any time prior to first kickoff.</p>
      </div>
      <div className="bowl-claim-stub">
        <button disabled={busy} onClick={onClaim} type="button">CLAIM YOUR SEAT</button>
      </div>
    </section>
  );
}
