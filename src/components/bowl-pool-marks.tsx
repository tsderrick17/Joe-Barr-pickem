import type { CSSProperties, ReactNode } from "react";
import { bowlPennantColors, bowlSeasonLabel } from "@/lib/bowl-pennant.js";
import { bowlTeamName } from "@/lib/bowl-pool.js";

type PennantTeam = { full_name?: string; short_name?: string | null; abbreviation?: string | null; primary_color?: string | null; secondary_color?: string | null } | null | undefined;

/**
 * A felt pennant in a school's own colors, lettered with its name. Every
 * pennant is the same size. It rises beside a team once that team is picked. Decorative:
 * the pick itself is announced by the button's pressed state.
 */
export function BowlPennant({ team, side }: { team: PennantTeam; side: "left" | "right" }) {
  const colors = bowlPennantColors(team);
  return (
    <span
      aria-hidden="true"
      className={`bowl-pennant is-${side}`}
      style={{ "--pennant-primary": colors.primary, "--pennant-secondary": colors.secondary, "--pennant-ink": colors.ink } as CSSProperties}
    >
      <span className="bowl-pennant-pole" />
      <span className="bowl-pennant-flag"><span>{bowlTeamName(team)}</span></span>
    </span>
  );
}

/** The Bowl Pool's heading: gold rules, three stars, the title in varsity lettering, and the season. */
export function BowlCrest({ action, seasonYear, title }: { action?: ReactNode; seasonYear: number; title: string }) {
  return (
    <div className="bowl-crest">
      <div className="bowl-crest-ornament" aria-hidden="true"><span /><i>★ ★ ★</i><span /></div>
      <div className="bowl-crest-title"><h2>{title}</h2>{action}</div>
      <p className="bowl-crest-season">{bowlSeasonLabel(seasonYear)}</p>
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
      </div>
      <div className="bowl-claim-stub">
        <button disabled={busy} onClick={onClaim} type="button">CLAIM YOUR SEAT</button>
      </div>
    </section>
  );
}
