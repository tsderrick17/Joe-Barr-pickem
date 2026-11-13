"use client";

import { useState } from "react";
import { BigBoardRoom, WindowRoom } from "@/components/lab/lab-tote";

/**
 * Lab try-out: the tote board, the owner's favourite of the Pad skins, as the clubhouse's two main pieces, side by side on the shelf.
 *  - The Big Board: everyone's picks in one place (today's Pad: wins, player, Pick 1, Pick 2; no place), Survivor's chips in their
 *    own column, and the season standings one tap away on the same board.
 *  - The Window: all of a player's picks in one place, two against the spread and the Survivor team, on one ticket with one Submit.
 * Sample players only; another player's pick stays covered (dark lamps, a green IN) until its game kicks off.
 */
export function LabToteBoard() {
  const [view, setView] = useState<"board" | "window">("board");
  return (
    <section aria-label="Tote board try-out" className="lab-tote-room">
      <div className="lab-skins-controls">
        <div aria-label="Board" className="lab-chips" role="group">
          {([["board", "The Big Board"], ["window", "The Window"]] as const).map(([key, label]) => <button aria-pressed={view === key} key={key} onClick={() => setView(key)} type="button">{label}</button>)}
        </div>
      </div>
      {view === "board" ? <BigBoardRoom /> : <WindowRoom />}
    </section>
  );
}
