"use client";

import { Logo } from "@/components/lab/lab-tote";
import PlayerTrophyName from "@/components/player-trophy-name";
import type { StandingsResponse } from "@/lib/api-contracts";

/**
 * The Survivor table in the Big Board's housing (green and gold, black panels, a lit ring round each week's team), with the same two tabs
 * over it. It shows exactly what the Survivor Table does: a row per player, a team for each week they have picked, IN or OUT beside the
 * name, and a hidden pick as three dark lamps until its game kicks off. It scrolls sideways; the status and the name stay put.
 */

const WEEKS = 18;
const mark = (value: string) => (value === "W" ? "W" : value === "L" ? "L" : null);

export default function SurvivorToteBoard({ home, onBoard }: { home: StandingsResponse; onBoard?: () => void }) {
  const rows = home.survivorRows ?? [];
  return (
    <div className="lab-tote lab-survivor-tote">
      <header>
        <h3>SURVIVOR</h3>
        <span>{String(home.week ?? "").toUpperCase()}</span>
      </header>
      {onBoard ? (
        <div className="lab-tote-links">
          <button onClick={onBoard} type="button">Big Board</button>
          <span aria-current="page">Survivor</span>
        </div>
      ) : null}
      {!home.survivorAvailable ? <p className="lab-survivor-note">Survivor is not running right now.</p> : (
        <div aria-label="Survivor Table, scrolls sideways" className="lab-survivor-scroll" role="region" tabIndex={0}>
          <table>
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
                        <td key={index}>
                          {pick?.abbreviation
                            ? <span aria-label={`${pick.label ?? pick.abbreviation}${result === "W" ? ", win" : result === "L" ? ", loss" : ""}`} className={`lab-tote-logo${result ? ` is-${result.toLowerCase()}` : ""}`} role="img"><Logo team={pick.abbreviation} /></span>
                            : pick?.isHidden ? <span aria-label="Selection submitted and hidden until kickoff" className="lab-tote-cover" role="img"><i /><i /><i /></span> : null}
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
