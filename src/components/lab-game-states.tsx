"use client";

import { useState } from "react";
import { ToteBoard } from "@/components/clubhouse/big-board";
import { RoomTicket } from "@/components/clubhouse/room-ticket";
import { labGameStates } from "@/lib/lab-game-states.js";

const STATES = labGameStates();

/**
 * The Lab's "Game states": the real Big Board and your ticket in each state a week can be in, on sample players. Pick a state with the
 * chips; the board and the ticket change together, exactly as they do in the clubhouse. Nothing here reads or changes pool data.
 */
export default function LabGameStates() {
  const [id, setId] = useState(STATES[0].id);
  const state = STATES.find((item) => item.id === id) ?? STATES[0];
  const at = STATES.findIndex((item) => item.id === state.id);
  return (
    <section aria-label="Game states" className="lab-states">
      <div aria-label="Game state" className="lab-chips" role="group">
        {STATES.map((item) => <button aria-pressed={item.id === state.id} key={item.id} onClick={() => setId(item.id)} type="button">{item.name}</button>)}
      </div>
      <p className="lab-states-about">{state.about}</p>
      <ToteBoard onOpen={() => {}} view={state.view} />
      <div className="lab-states-ticket">
        <RoomTicket onOpen={() => {}} ticket={state.ticket} week={state.view.week} />
      </div>
      <div className="lab-chips lab-states-step">
        <button disabled={at <= 0} onClick={() => setId(STATES[at - 1].id)} type="button">Earlier state</button>
        <span>{at + 1} of {STATES.length}</span>
        <button disabled={at >= STATES.length - 1} onClick={() => setId(STATES[at + 1].id)} type="button">Next state</button>
      </div>
    </section>
  );
}
