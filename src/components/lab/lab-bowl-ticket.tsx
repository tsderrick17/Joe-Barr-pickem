"use client";

import { useState } from "react";
import { BowlTicketCard, type BowlTicketData } from "@/components/bowl-ticket";
import type { BowlSide } from "@/lib/bowl-ticket-view.js";
import { LAB_BOWL_MINE, LAB_BOWL_STOPS, LAB_BOWLS, labBowlView } from "@/lib/lab-bowl-samples.js";

/**
 * Lab try-out: the Bowl ticket (src/components/bowl-ticket.tsx, the clubhouse's Bowl Pool) on sample bowls and players. The day chooser
 * walks the sample season so the gauge and the pennants can be seen moving; the pennant choice shows the name pennants a bowl without a
 * logo file flies. Nothing is saved.
 */
export function LabBowlTicket() {
  const [stopId, setStopId] = useState(LAB_BOWL_STOPS[1].id);
  const [flagStyle, setFlagStyle] = useState<"name" | "logo">("logo");
  const [mine, setMine] = useState<Record<string, "away" | "home">>(LAB_BOWL_MINE as Record<string, "away" | "home">);
  const [guess, setGuess] = useState("");
  const stop = LAB_BOWL_STOPS.find((item) => item.id === stopId) ?? LAB_BOWL_STOPS[0];
  const view = labBowlView(stop.played, mine, guess) as BowlTicketData;

  // Saving turns the ticket's favourite / underdog picks back into the sample's away / home.
  function save(picks: Record<string, BowlSide>, nextGuess: string) {
    const next = { ...mine };
    for (const game of LAB_BOWLS.slice(stop.played)) {
      const side = picks[game.id];
      if (!side) delete next[game.id];
      else next[game.id] = (side === "favorite") === (game.favourite === "away") ? "away" : "home";
    }
    setMine(next);
    setGuess(nextGuess);
  }

  return (
    <section aria-label="Bowl ticket try-out" className="lab-tote-room">
      <div aria-label="Day of bowl season" className="lab-chips" role="group">
        {LAB_BOWL_STOPS.map((item) => <button aria-pressed={item.id === stop.id} key={item.id} onClick={() => setStopId(item.id)} type="button">{item.label}</button>)}
      </div>
      <div aria-label="Pennant style" className="lab-chips" role="group">
        <button aria-pressed={flagStyle === "logo"} onClick={() => setFlagStyle("logo")} type="button">Logo pennants</button>
        <button aria-pressed={flagStyle === "name"} onClick={() => setFlagStyle("name")} type="button">Name pennants</button>
      </div>
      <BowlTicketCard flagStyle={flagStyle} key={`${stop.id}:${JSON.stringify(mine)}:${guess}`} onSave={save} view={view} />
    </section>
  );
}
