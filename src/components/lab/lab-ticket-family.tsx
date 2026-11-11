"use client";

import { useState } from "react";
import MyTicket, { type TicketPick } from "@/components/my-ticket";
import SlateReceipt, { type ReceiptTeam } from "@/components/slate-receipt";

/**
 * Lab try-out: the real Slate receipt and the real ticket, with sample picks, shown as they are today and refined as one family.
 * "Refined" only adds the `ticket-family` class around them (src/styles/81-lab.css): the same paper, ink, edges and notches on both,
 * while the ticket keeps its masthead, columns and barcode and the receipt keeps its strip, chips and SUBMIT. Going live later is that
 * one class on the real pages. Sample data only; the receipt's buttons do nothing here.
 */

type Look = "today" | "refined";
type Scene = "saved" | "gameday" | "graded";

const SCENES: Array<{ id: Scene; label: string }> = [
  { id: "saved", label: "Saved" },
  { id: "gameday", label: "Game day" },
  { id: "graded", label: "Graded" },
];

const PICKS = [
  { gameId: "g1", name: "Pittsburgh Steelers", abbreviation: "PIT", line: "-2.5", kickoff: "Oct 1 · 8:15 PM EDT" },
  { gameId: "g3", name: "Los Angeles Rams", abbreviation: "LAR", line: "+3", kickoff: "Oct 4 · 1:00 PM EDT" },
];

function ticketPicks(scene: Scene): TicketPick[] {
  return PICKS.map((pick, index) => ({
    gameId: pick.gameId,
    team: pick.name,
    kickoff: pick.kickoff,
    spread: pick.line,
    lineLocked: scene !== "saved" || index === 0,
    resultMark: scene === "graded" ? (index === 0 ? "W" : "L") : scene === "gameday" && index === 0 ? "W" : "",
  }));
}

function receiptTeams(scene: Scene): ReceiptTeam[] {
  return PICKS.map((pick, index) => ({
    gameId: pick.gameId,
    name: pick.name,
    abbreviation: pick.abbreviation,
    lineValue: pick.line,
    isLineLocked: scene !== "saved" || index === 0,
    canRemove: scene === "saved" || (scene === "gameday" && index === 1),
    isSaved: true,
  }));
}

const nothing = () => {};

export function LabTicketFamily() {
  const [look, setLook] = useState<Look>("refined");
  const [scene, setScene] = useState<Scene>("saved");
  const sealed = scene === "graded";

  return (
    <section aria-label="Ticket and receipt try-out" className="lab-family-room">
      <div className="lab-family-controls">
        <div aria-label="Look" className="lab-chips" role="group">
          <button aria-pressed={look === "today"} onClick={() => setLook("today")} type="button">Today</button>
          <button aria-pressed={look === "refined"} onClick={() => setLook("refined")} type="button">Refined</button>
        </div>
        <div aria-label="Week" className="lab-chips" role="group">
          {SCENES.map((item) => <button aria-pressed={scene === item.id} key={item.id} onClick={() => setScene(item.id)} type="button">{item.label}</button>)}
        </div>
      </div>

      <div className={`lab-family ${look === "refined" ? "ticket-family" : ""}`} data-look={look}>
        <p className="lab-family-label">On the Slate</p>
        <SlateReceipt
          isLoading={false}
          isSubmitting={false}
          onRemove={nothing}
          onSubmit={nothing}
          periodType="regular"
          pickemHasUnsavedChanges={false}
          selectedPickCount={2}
          selectedTeams={receiptTeams(scene)}
          selectionLimit={2}
          selectionWarning=""
          survivor={{ show: true, controlsEnabled: !sealed, hasUnsavedChanges: false, hasPick: true, teamName: "Buffalo Bills", status: "active", details: { name: "Buffalo Bills", abbreviation: "BUF" } }}
        />
        <p className="lab-family-label">On Standings</p>
        <MyTicket
          maxPicks={2}
          picks={ticketPicks(scene)}
          survivorAvailable
          survivorPick={{ abbreviation: "BUF", team: "Buffalo Bills", kickoff: "Oct 4 · 1:00 PM EDT", resultMark: scene === "graded" ? "W" : "" }}
          survivorStatus="active"
          week="WEEK 5"
        />
      </div>
    </section>
  );
}
