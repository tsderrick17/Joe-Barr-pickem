import type { CSSProperties, ReactNode } from "react";
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

/**
 * A cheerleader's megaphone in a school's own colors, lettered with its name: a narrow mouthpiece with a bulge, a cone flaring to a wide bell
 * with a dark inside, a band near the bell and a small handle underneath. When a team is picked it swings up and gives a cheer (three little
 * sound arcs by the bell). The same size for every school. Decorative: the pick itself is announced by the button's pressed state.
 */
export function BowlMegaphone({ team, side }: { team: PennantTeam; side: "left" | "right" }) {
  const colors = bowlPennantColors(team);
  const lines = nameLines(bowlTeamName(team).toUpperCase());
  return (
    <span
      aria-hidden="true"
      className={`bowl-megaphone is-${side}`}
      style={{ "--megaphone-primary": colors.primary, "--megaphone-secondary": colors.secondary, "--megaphone-ink": colors.ink } as CSSProperties}
    >
      <svg focusable="false" viewBox="0 0 124 47">
        <g className="bowl-megaphone-waves">
          <path d="M105 13Q111 23.5 105 34" /><path d="M109.5 9Q117.5 23.5 109.5 38" /><path d="M114 5Q124 23.5 114 42" />
        </g>
        <g className="bowl-megaphone-art">
          <rect className="bowl-megaphone-trim" height="8" rx="2" width="16" x="3" y="19.5" />
          <path className="bowl-megaphone-body" d="M20 19.5L96 3V44L20 27.5Z" />
          <path className="bowl-megaphone-trim" d="M82 5.4L88.6 4V43L82 41.6Z" />
          <path className="bowl-megaphone-light" d="M20 19.5L96 3V14L20 22.4Z" />
          <path className="bowl-megaphone-dim" d="M20 25L96 33V44L20 27.5Z" />
          <ellipse className="bowl-megaphone-body" cx="96" cy="23.5" rx="6.5" ry="20.5" />
          <ellipse className="bowl-megaphone-inside" cx="96" cy="23.5" rx="6.5" ry="20.5" />
          <ellipse className="bowl-megaphone-rim" cx="96" cy="23.5" rx="6.5" ry="20.5" />
          <ellipse className="bowl-megaphone-trim" cx="15" cy="23.5" rx="5.6" ry="7.6" />
          <path className="bowl-megaphone-handle" d="M41 31.6C41 42 57 43.5 56 35.6" />
          <text className="bowl-megaphone-name" textLength={lines.length > 1 ? 32 : Math.min(36, 5 * lines[0].length)} lengthAdjust="spacingAndGlyphs" x="60" y={lines.length > 1 ? 21.5 : 26}>{lines[0]}</text>
          {lines[1] ? <text className="bowl-megaphone-name" textLength={Math.min(32, 5 * lines[1].length)} lengthAdjust="spacingAndGlyphs" x="60" y="31">{lines[1]}</text> : null}
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
