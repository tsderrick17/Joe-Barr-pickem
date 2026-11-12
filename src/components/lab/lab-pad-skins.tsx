"use client";

import { useState, type CSSProperties } from "react";
import { LAB_MOMENTS, LAB_VIEWER, labLeaderboard, labStandard } from "@/lib/lab-clubhouse.js";

/**
 * Lab try-out: Pick'em Pad skins. One sample Pick'em Pad (place, player, wins, this week's two picks) dressed five ways from the owner's
 * back-pocket list: an airport split-flap board, a scratch-off card, a racetrack tote board, a bowling sheet and an old ballpark's
 * hand-hung plates. Every skin shows the same standings and the same picks; only the material changes. Another player's pick stays
 * covered until its game kicks off, each skin covering it its own way.
 */

type Skin = "flap" | "scratch" | "tote" | "bowling" | "ballpark";
const SKINS: ReadonlyArray<readonly [Skin, string]> = [
  ["flap", "Split-flap"], ["scratch", "Scratch-off"], ["tote", "Tote board"], ["bowling", "Bowling sheet"], ["ballpark", "Ballpark"],
];
const TITLES: Record<Skin, { title: string; sub: string }> = {
  flap: { title: "PICK'EM", sub: "WEEK 10 · BOARDING" },
  scratch: { title: "Pick'em Pad", sub: "Week 10 · scratch at kickoff" },
  tote: { title: "PICK'EM", sub: "WEEK 10 · OFFICIAL" },
  bowling: { title: "Pick'em Pad", sub: "Week 10 · Lane 1" },
  ballpark: { title: "PICK'EM", sub: "WEEK 10" },
};

/** Text in split-flap tiles: one tile per letter, each turning in a beat after the one before. */
function Flaps({ text }: { text: string }) {
  return <span className="lab-flaps" aria-label={text} role="img">{[...text].map((char, index) => <span aria-hidden="true" className="lab-flapchar" key={index} style={{ "--i": index } as CSSProperties}>{char === " " ? " " : char}</span>)}</span>;
}

export function LabPadSkins() {
  const [skin, setSkin] = useState<Skin>("flap");
  const [moment, setMoment] = useState("gameday");
  const rows = labLeaderboard({ round: "regular", moment });
  const text = (value: string | number) => (skin === "flap" ? <Flaps text={String(value)} /> : <>{value}</>);
  return (
    <section aria-label="Pick'em Pad skins try-out" className="lab-skins-room">
      <div className="lab-skins-controls">
        <div aria-label="Skin" className="lab-chips" role="group">
          {SKINS.map(([key, label]) => <button aria-pressed={skin === key} key={key} onClick={() => setSkin(key)} type="button">{label}</button>)}
        </div>
        <div aria-label="Moment" className="lab-chips" role="group">
          {LAB_MOMENTS.map((item) => <button aria-pressed={moment === item.id} key={item.id} onClick={() => setMoment(item.id)} type="button">{item.label}</button>)}
        </div>
      </div>
      <div className={`lab-pad skin-${skin}`} key={`${skin}-${moment}`}>
        <header><h3>{TITLES[skin].title}</h3><span>{TITLES[skin].sub}</span></header>
        <table>
          <colgroup><col className="lab-pad-col-place" /><col /><col className="lab-pad-col-wins" /><col className="lab-pad-col-pick" /><col className="lab-pad-col-pick" /></colgroup>
          <thead><tr><th scope="col"><span className="sr-only">Place</span></th><th scope="col">PLAYER</th><th scope="col">W</th><th scope="col">PICK 1</th><th scope="col">PICK 2</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const standard = labStandard(row.name, { round: "regular", moment });
              return (
                <tr className={row.name === LAB_VIEWER ? "is-you" : ""} key={row.name}>
                  <td className="lab-pad-place">{text(`${row.tied ? "T" : ""}${row.place}`)}</td>
                  <th className="lab-pad-name" scope="row">{text(row.name.toUpperCase())}</th>
                  <td className="lab-pad-wins">{text(row.wins)}</td>
                  {standard.slats.map((slat) => (
                    <td className={`lab-pad-pick ${slat.hidden ? "is-hidden" : slat.result ? `is-${slat.result.toLowerCase()}` : "is-live"}`} key={slat.gameId}>
                      {slat.hidden
                        ? <span aria-label="Hidden until kickoff" className="lab-pad-cover" role="img">{skin === "scratch" ? "SCRATCH AT KICKOFF" : "🔒"}</span>
                        : <span className="lab-pad-slip">{text(slat.team ?? "")}<small>{slat.line}</small>{slat.result ? <b aria-label={slat.result === "W" ? "win" : "loss"} className="lab-pad-mark">{slat.result}</b> : null}</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="lab-pad-note">Same standings and picks in every skin; only the look changes.</p>
      </div>
    </section>
  );
}
