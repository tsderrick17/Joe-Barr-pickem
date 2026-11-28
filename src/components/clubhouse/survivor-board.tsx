"use client";

import { haptic } from "@/lib/haptics-client";
import { useLayoutEffect, useRef } from "react";
import { HiddenPick } from "@/components/clubhouse/lamps";
import PlayerTrophyName from "@/components/player-trophy-name";
import SurvivorPokerChip from "@/components/survivor-poker-chip";
import type { StandingsResponse } from "@/lib/api-contracts";

/**
 * The Survivor table in the Big Board's housing (green and gold, black panels, a lit ring round each week's team), with the same two tabs
 * over it. It shows exactly what the Survivor Table does: a row per player, a team for each week they have picked, IN or OUT beside the
 * name, and a hidden pick as one lit spade lamp until its game kicks off. It scrolls sideways; the status and the name stay put.
 * Only the weeks played so far and the one after are columns (never the empty rest of the season), and it opens scrolled to the
 * latest week, not week 1.
 */

/** The columns to show: every week up to the latest anyone has picked, plus the next one while Survivor is still being played (once it is
 * decided, or nobody is left in, there is no next week to show). */
export function survivorWeekCount(rows: StandingsResponse["survivorRows"], decided = false) {
  const total = Math.max(0, ...rows.map((row) => row.picks.length));
  const last = Math.max(-1, ...rows.flatMap((row) => row.picks.map((pick, index) => (pick ? index : -1))));
  const over = decided || (rows.length > 0 && rows.every((row) => row.status !== "active"));
  return Math.min(total, Math.max(1, last + (over ? 1 : 2)));
}
const mark = (value: string) => (value === "W" ? "W" : value === "L" ? "L" : null);

export default function SurvivorToteBoard({ home, onBoard, onPick }: { home: StandingsResponse; onBoard?: () => void; onPick?: () => void }) {
  const rows = home.survivorRows ?? [];
  const WEEKS = survivorWeekCount(rows, Boolean(home.survivorComplete));
  const scroller = useRef<HTMLDivElement>(null);
  // Open on the latest week, and stay there while the sheet and its logos settle, until the player scrolls it themselves.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let touched = false;
    const toEnd = () => { if (!touched) node.scrollLeft = node.scrollWidth; };
    const hold = () => { touched = true; };
    toEnd();
    const watch = new ResizeObserver(toEnd);
    watch.observe(node);
    if (node.firstElementChild) watch.observe(node.firstElementChild);
    node.addEventListener("pointerdown", hold);
    node.addEventListener("wheel", hold, { passive: true });
    node.addEventListener("keydown", hold);
    return () => { watch.disconnect(); node.removeEventListener("pointerdown", hold); node.removeEventListener("wheel", hold); node.removeEventListener("keydown", hold); };
  }, [WEEKS]);
  return (
    <div className="lab-tote lab-survivor-tote">
      <header>
        <h3>SURVIVOR</h3>
        <span className="lab-survivor-when">
          <span>{String(home.week ?? "").toUpperCase()}</span>
          {/* Your Survivor pick is made on your ticket: this opens it on Survivor. */}
          {onPick ? <button className="lab-survivor-pick" onClick={() => { haptic("tick"); onPick(); }} type="button">Make pick <span aria-hidden="true">›</span></button> : null}
        </span>
      </header>
      {onBoard ? (
        <div className="lab-tote-links">
          <button onClick={() => { haptic("tick"); onBoard(); }} type="button">Big Board</button>
          <span aria-current="page">Survivor</span>
        </div>
      ) : null}
      {!home.survivorAvailable ? <p className="lab-survivor-note">Survivor is not running right now.</p> : (
        <div aria-label="Survivor Table, scrolls sideways" className="lab-survivor-scroll" ref={scroller} role="region" tabIndex={0}>
          <table style={{ minWidth: `${8.2 + WEEKS * 2.6}rem` }}>
            <colgroup><col className="lab-survivor-col-status" /><col className="lab-survivor-col-name" />{Array.from({ length: WEEKS }, (_, index) => <col className="lab-survivor-col-week" key={index} />)}</colgroup>
            <thead>
              <tr>
                <th className="lab-survivor-status" scope="col"><span className="sr-only">Status</span></th>
                <th className="lab-survivor-name" scope="col">PLAYER</th>
                {Array.from({ length: WEEKS }, (_, index) => <th key={index} scope="col">{index + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const champion = Boolean(home.survivorComplete) && row.playerId === home.survivorChampionPlayerId;
                const out = !champion && row.status !== "active";
                return (
                  <tr className={`${row.playerId === home.viewerPlayerId ? "is-you" : ""}${out ? " is-out" : ""}`} key={row.id}>
                    <td className="lab-survivor-status">{champion ? <span className="lab-tote-won">WON</span> : out ? <span className="lab-tote-out">OUT</span> : <span className="lab-tote-in">IN</span>}</td>
                    <th className="lab-tote-name lab-survivor-name" scope="row"><PlayerTrophyName name={row.firstName.toUpperCase()} showTrophy={Boolean(row.holdsSurvivorTrophy)} titles={row.trophies} /></th>
                    {Array.from({ length: WEEKS }, (_, index) => {
                      const pick = row.picks[index];
                      const result = pick ? mark(pick.resultMark) : null;
                      return (
                        <td className={out && !pick ? "is-blank" : undefined} key={index}>
                          {pick?.abbreviation
                            ? <span aria-label={`${pick.label ?? pick.abbreviation}${result === "W" ? ", win" : result === "L" ? ", loss" : ""}`} className={`lab-tote-logo lab-survivor-chip${result ? ` is-${result.toLowerCase()}` : ""}`} role="img"><SurvivorPokerChip abbreviation={pick.abbreviation} size="table" teamName={pick.label ?? pick.abbreviation} /></span>
                            : pick?.isHidden ? <HiddenPick label="Selection submitted and hidden until kickoff" survivor /> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
