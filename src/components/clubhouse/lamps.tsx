"use client";

import Image from "next/image";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/** A pick that is in but not shown yet: one lit lamp, the same as the ticket's lamp for a pick sent in (a spade for Survivor). It reads as
 * made, never as empty, and never says which team. */
export function HiddenPick({ survivor = false, label = "Pick in, hidden until kickoff" }: { survivor?: boolean; label?: string }) {
  return (
    <span className="lab-tote-cover">
      <Lamp label={label} state="in" survivor={survivor} />
    </span>
  );
}

/** No pick (yet): the same lamp in the same place, just not lit, so every row reads the same and a missing pick is plain to see. */
export function NoPick({ survivor = false, label }: { survivor?: boolean; label: string }) {
  return (
    <span className="lab-tote-cover">
      <Lamp label={label} state="off" survivor={survivor} />
    </span>
  );
}

/**
 * The lamp: one for every pick, 1:1 with Pick 1, Pick 2 and Survivor, at the top of your ticket and on the ticket pinned in the
 * clubhouse. The Big Board shows the same colours in the team names themselves.
 *  - dark: no pick. A gold ring with a dark centre: picked on your ticket, not sent yet. Lit yellow: sent, the game not decided.
 *    Green: it won. Red: it lost.
 *  - Survivor's lamp is a poker chip (the dashed rim Survivor wears everywhere in the pool), so it is never taken for a Pick'em pick.
 */
export type LampState = "off" | "picked" | "in" | "won" | "lost";
export const LAMP_SAYS: Record<LampState, string> = { off: "no pick", picked: "picked, not sent", in: "in", won: "won", lost: "lost" };
export function Lamp({ state, survivor = false, label }: { state: LampState; survivor?: boolean; label?: string }) {
  return <span aria-label={label ?? LAMP_SAYS[state]} className={`lab-lamp is-${state}${survivor ? " is-survivor" : ""}`} role="img" />;
}
export const lampFor = (result: string | null | undefined): LampState => (result === "W" ? "won" : result === "L" ? "lost" : "in");

/** A team's logo, sized evenly whatever the artwork (see team-logo-scale). */
export function Logo({ team, eager = false }: { team: string; eager?: boolean }) {
  return <Image alt="" className="lab-room-logo" height={24} loading={eager ? "eager" : undefined} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={24} />;
}
