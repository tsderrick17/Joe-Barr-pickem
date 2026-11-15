"use client";

import { useState } from "react";
import SurvivorTable, { type SurvivorTableData } from "@/components/survivor-table";
import { LAB_SURVIVOR_LAST_WEEK, LAB_TEAM_NAMES, labSurvivorAt, labSurvivorChampion } from "@/lib/lab-samples.js";

/**
 * Lab try-out: Survivor exactly as the pool shows it today (the owner prefers it to the poker-table try-outs, which are gone), fed
 * from the sample players, with a week stepper and the moment of the week so it can be looked at in any state. This is where
 * improvements to the real Survivor view are tried first. Sample players only; nothing here reads or writes the pool.
 */

type Week = { week: number; team: string; result: "W" | "L" };
type Seat = { name: string; weeks: Week[]; out: boolean; outWeek: number | null; current: { team: string; result: "W" | "L" } | null };
type Moment = "before" | "gameday" | "graded";

const VIEWER = "Walt";
/** In the sample, before kickoff this player has not made this week's pick yet. */
const NOT_PICKED = "June";
const PLAYOFFS = LAB_SURVIVOR_LAST_WEEK + 1;

const teamName = (team: string) => LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES] ?? team;

/** The table at a week and moment: each seat's state, and this week's chips on the felt. */
function tableAt(week: number, moment: Moment) {
  const graded = moment === "graded" || week >= PLAYOFFS;
  const raw = labSurvivorAt(Math.min(week, LAB_SURVIVOR_LAST_WEEK)) as Seat[];
  const seats = raw.map((seat) => {
    // Until this week is graded, a loss this week has not happened yet: the seat is still in and its last week is still to play.
    const losingNow = !graded && seat.out && seat.outWeek === week;
    const weeks = graded ? seat.weeks : seat.weeks.filter((pick) => pick.week < week);
    const out = seat.out && !losingNow;
    const pickThisWeek = week < PLAYOFFS && seat.current && !(seat.out && (seat.outWeek ?? 0) < week) ? seat.current : null;
    const noPick = moment === "before" && seat.name === NOT_PICKED && Boolean(pickThisWeek);
    const hidden = moment === "before" && seat.name !== VIEWER && Boolean(pickThisWeek) && !noPick;
    const lost = out ? seat.weeks[seat.weeks.length - 1] : null;
    return { ...seat, weeks, out, pickThisWeek: noPick ? null : pickThisWeek, noPick, hidden, lostTo: lost?.result === "L" ? lost.team : null };
  });
  const onBox = new Map<string, { names: string[]; swept: boolean }>();
  for (const seat of seats) {
    if (!seat.pickThisWeek || seat.hidden) continue;
    const box = onBox.get(seat.pickThisWeek.team) ?? { names: [], swept: false };
    box.names.push(seat.name);
    box.swept ||= graded && seat.pickThisWeek.result === "L";
    onBox.set(seat.pickThisWeek.team, box);
  }
  // Standings order: still in first (most weeks survived), then out (latest out first), then by name.
  const order = [...seats].sort((a, b) => Number(a.out) - Number(b.out) || (b.outWeek ?? 99) - (a.outWeek ?? 99) || b.weeks.length - a.weeks.length || a.name.localeCompare(b.name));
  return { seats: order, onBox, graded, alive: seats.filter((seat) => !seat.out).length, champion: graded || week >= PLAYOFFS ? labSurvivorChampion(Math.min(week, LAB_SURVIVOR_LAST_WEEK)) : null };
}

function listData(seats: Seat[], week: number): SurvivorTableData {
  return {
    viewerPlayerId: VIEWER,
    week: week >= PLAYOFFS ? "Wild Card" : `Week ${week}`,
    showSurvivorStandings: true,
    hideSurvivorEliminatedRows: false,
    survivorAvailable: true,
    survivorNotice: null,
    survivorRows: seats.map((seat) => ({
      id: seat.name,
      playerId: seat.name,
      firstName: seat.name,
      status: seat.out ? "eliminated" : "active",
      picks: seat.weeks.map((pick) => ({ label: teamName(pick.team), abbreviation: pick.team, resultMark: pick.result })),
    })),
  };
}

export function LabSurvivorTable() {
  const [week, setWeek] = useState(7);
  const [moment, setMoment] = useState<Moment>("graded");
  const { seats } = tableAt(week, moment);
  const playoffs = week >= PLAYOFFS;
  return (
    <section aria-label="Survivor try-out" className="lab-survivor-room">
      <div className="lab-room-controls lab-survivor-controls">
        <div aria-label="Week" className="lab-stepper" role="group">
          <button aria-label="Earlier week" disabled={week <= 1} onClick={() => setWeek(week - 1)} type="button">‹</button>
          <strong aria-live="polite">{playoffs ? "Playoffs" : `Week ${week}`}</strong>
          <button aria-label="Later week" disabled={week >= PLAYOFFS} onClick={() => setWeek(week + 1)} type="button">›</button>
        </div>
        {playoffs ? null : <div aria-label="Moment" className="lab-chips" role="group">
          {([["before", "Before kickoff"], ["gameday", "Game day"], ["graded", "Graded"]] as const).map(([key, label]) => <button aria-pressed={moment === key} key={key} onClick={() => setMoment(key)} type="button">{label}</button>)}
        </div>}
      </div>
      <SurvivorTable data={listData(seats, week)} displayLocked savingDisplay={false} setEliminatedRowsHidden={() => {}} setSurvivorDisplay={() => {}} />
    </section>
  );
}
