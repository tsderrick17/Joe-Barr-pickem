"use client";

import { useState } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";
import { SlateRoom } from "@/components/lab/lab-clubhouse";
import { LAB_MOMENTS, LAB_VIEWER, labLeaderboard, labStandard } from "@/lib/lab-clubhouse.js";
import { LAB_TEAM_NAMES } from "@/lib/lab-samples.js";

/**
 * Lab try-out: the tote board, the owner's favourite of the Pad skins, built out for the Pick'em Pad and the Slate as one family.
 *  - The Pad keeps today's format exactly: wins, player, Pick 1, Pick 2 (no place). Wins burn in amber lamps; each pick is a black
 *    panel (team and line) with its W or L lamp in a fixed slot, so every W and L in a column sits on one centre line.
 *  - Survivor rides on the same board in its own column, as the real Survivor poker chips: face down until its game kicks off.
 *  - A pick that is made but still hidden is shown three ways to choose from (no padlock): Lamps dark, Sealed, Face down.
 *  - The Slate is the big board in the same housing, its pick framed by a single gilt line.
 * Sample players only; another player's pick stays covered until its game kicks off, exactly as on the real pages.
 */

type Cover = "lamps" | "sealed" | "facedown";
const COVERS: ReadonlyArray<readonly [Cover, string]> = [["lamps", "Lamps dark"], ["sealed", "Sealed"], ["facedown", "Face down"]];

/** A pick that is in but not shown yet: it reads as made, never as empty, and never says which team. */
function HiddenPick({ cover }: { cover: Cover }) {
  return (
    <span aria-label="Pick in, hidden until kickoff" className={`lab-tote-cover is-${cover}`} role="img">
      {cover === "lamps" ? <><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><b aria-hidden="true">IN</b></> : null}
      {cover === "sealed" ? <b aria-hidden="true">SEALED</b> : null}
    </span>
  );
}

function Pad({ moment, cover }: { moment: string; cover: Cover }) {
  const rows = labLeaderboard({ round: "regular", moment });
  return (
    <div className="lab-tote">
      <header><h3>PICK’EM</h3><span>WEEK 10 · OFFICIAL</span></header>
      <table>
        <colgroup><col className="lab-tote-col-wins" /><col /><col className="lab-tote-col-pick" /><col className="lab-tote-col-pick" /><col className="lab-tote-col-surv" /></colgroup>
        <thead><tr><th scope="col">W</th><th scope="col">PLAYER</th><th scope="col">PICK 1</th><th scope="col">PICK 2</th><th scope="col"><span aria-hidden="true">SURV</span><span className="sr-only">Survivor</span></th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const standard = labStandard(row.name, { round: "regular", moment });
            const survivor = standard.survivor;
            return (
              <tr className={row.name === LAB_VIEWER ? "is-you" : ""} key={row.name}>
                <td className="lab-tote-wins">{row.wins}</td>
                <th className="lab-tote-name" scope="row">{row.name.toUpperCase()}</th>
                {standard.slats.map((slat) => (
                  <td className="lab-tote-pick" key={slat.gameId}>
                    {slat.hidden ? <HiddenPick cover={cover} /> : (
                      <span className="lab-tote-slip">
                        <b>{slat.team}</b>
                        <small>{slat.line}</small>
                        <span aria-label={slat.result === "W" ? "win" : slat.result === "L" ? "loss" : "not final"} className={`lab-tote-mark ${slat.result ? `is-${slat.result.toLowerCase()}` : ""}`} role="img">{slat.result ?? ""}</span>
                      </span>
                    )}
                  </td>
                ))}
                <td className="lab-tote-surv">
                  {survivor === null ? <span className="lab-tote-out">OUT</span>
                    : survivor.hidden || !survivor.team ? <span aria-label="Survivor pick in, hidden until kickoff" className="lab-tote-chip-back" role="img" />
                    : (
                      <span className="lab-tote-chip">
                        <SurvivorPokerChip abbreviation={survivor.team} size="summary" teamName={LAB_TEAM_NAMES[survivor.team as keyof typeof LAB_TEAM_NAMES]} unavailable={survivor.result === "L"} />
                        {survivor.result ? <span aria-label={survivor.result === "W" ? "Survivor win" : "Survivor loss"} className={`lab-tote-mark is-${survivor.result.toLowerCase()}`} role="img">{survivor.result}</span> : null}
                      </span>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LabToteBoard() {
  const [view, setView] = useState<"pad" | "slate">("pad");
  const [moment, setMoment] = useState("before");
  const [cover, setCover] = useState<Cover>("lamps");
  return (
    <section aria-label="Tote board try-out" className="lab-tote-room">
      <div className="lab-skins-controls">
        <div aria-label="Board" className="lab-chips" role="group">
          {([["pad", "The Pad"], ["slate", "The Slate"]] as const).map(([key, label]) => <button aria-pressed={view === key} key={key} onClick={() => setView(key)} type="button">{label}</button>)}
        </div>
        {view === "pad" ? (
          <>
            <div aria-label="Moment" className="lab-chips" role="group">
              {LAB_MOMENTS.map((item) => <button aria-pressed={moment === item.id} key={item.id} onClick={() => setMoment(item.id)} type="button">{item.label}</button>)}
            </div>
            <div aria-label="Pick made" className="lab-chips" role="group">
              {COVERS.map(([key, label]) => <button aria-pressed={cover === key} key={key} onClick={() => setCover(key)} type="button">{label}</button>)}
            </div>
          </>
        ) : null}
      </div>
      {view === "pad" ? <Pad cover={cover} moment={moment} /> : <SlateRoom tote />}
    </section>
  );
}
