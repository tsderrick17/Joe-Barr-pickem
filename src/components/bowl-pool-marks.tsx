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
        <defs><clipPath id={cone}><path d={CONE} /></clipPath></defs>
        <g className="bowl-megaphone-waves">
          <path d="M101.5 13Q107.5 23.5 101.5 34" /><path d="M105.5 8.5Q113.5 23.5 105.5 38.5" /><path d="M109.5 4Q119.5 23.5 109.5 43" />
        </g>
        <g className="bowl-megaphone-art">
          <path className="bowl-megaphone-handle-edge" d="M30 29.8V36.5Q30 40.5 34 40.5H42Q46 40.5 46 36.5V33.4" />
          <path className="bowl-megaphone-handle" d="M30 29.8V36.5Q30 40.5 34 40.5H42Q46 40.5 46 36.5V33.4" />
          <path className="bowl-megaphone-body" d={CONE} />
          <g clipPath={`url(#${cone})`}>
            <rect className="bowl-megaphone-light" height="14" width="100" x="6" y="2" />
            <rect className="bowl-megaphone-dim" height="14" width="100" x="6" y="33" />
            <rect className="bowl-megaphone-trim" height="50" width="6.5" x="78" y="0" />
          </g>
          <path className="bowl-megaphone-edge" d={CONE} />
          <ellipse className="bowl-megaphone-inside" cx="92" cy="23.5" rx="6.5" ry="21" />
          <ellipse className="bowl-megaphone-rim" cx="92" cy="23.5" rx="6.5" ry="21" />
          <rect className="bowl-megaphone-lip" height="15.6" rx="3.5" width="7" x="3" y="15.7" />
          <text className="bowl-megaphone-name" textLength={lines.length > 1 ? 34 : Math.min(38, 5 * lines[0].length)} lengthAdjust="spacingAndGlyphs" x="54" y={lines.length > 1 ? 21 : 25.8}>{lines[0]}</text>
          {lines[1] ? <text className="bowl-megaphone-name" textLength={Math.min(34, 5 * lines[1].length)} lengthAdjust="spacingAndGlyphs" x="54" y="30.8">{lines[1]}</text> : null}
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
