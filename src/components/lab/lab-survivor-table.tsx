"use client";

import Image from "next/image";
import { useState } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import SurvivorTable, { type SurvivorTableData } from "@/components/survivor-table";
import { LAB_DIVISIONS, LAB_SURVIVOR_SCENES, LAB_TEAM_NAMES, labSurvivorAt } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * Lab try-out: Survivor as a card table. On the felt, every team is a box on the layout (the craps idea), and this week's chips sit on
 * the team each player took; a team that lost has its box swept. Around the rail, each player is a seat with a stack of chips, one
 * per week survived (the poker idea); a seat that is out goes dark. Tap a seat to fan out that player's weeks. The List switch shows
 * today's Survivor Table with the same sample league. Sample data only; nothing here reads or writes the pool.
 */

type Week = { week: number; team: string; result: "W" | "L" };
type Seat = { name: string; weeks: Week[]; out: boolean; outWeek: number | null; current: { team: string; result: "W" | "L" } | null };
type View = "table" | "list";

const teamName = (team: string) => LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES] ?? team;

function Logo({ team, size }: { team: string; size: number }) {
  return <Image alt="" className="lab-felt-logo" height={size} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={size} />;
}

function listData(seats: Seat[], week: number): SurvivorTableData {
  return {
    viewerPlayerId: "",
    week: `Week ${week}`,
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
  const [view, setView] = useState<View>("table");
  const [scene, setScene] = useState(LAB_SURVIVOR_SCENES[1].id);
  const [open, setOpen] = useState<string | null>(null);
  const week = LAB_SURVIVOR_SCENES.find((item) => item.id === scene)!.week;
  const seats = labSurvivorAt(week) as Seat[];
  const alive = seats.filter((seat) => !seat.out).length;
  // This week's chips on the layout: who took each team, and whether that team lost.
  const onBox = new Map<string, { names: string[]; lost: boolean }>();
  for (const seat of seats) {
    if (!seat.current) continue;
    const box = onBox.get(seat.current.team) ?? { names: [], lost: false };
    box.names.push(seat.name);
    box.lost ||= seat.current.result === "L";
    onBox.set(seat.current.team, box);
  }
  const chosen = seats.find((seat) => seat.name === open) ?? null;

  return (
    <section aria-label="Survivor table try-out" className="lab-survivor-room" data-view={view}>
      <div className="lab-family-controls">
        <div aria-label="View" className="lab-chips" role="group">
          <button aria-pressed={view === "table"} onClick={() => setView("table")} type="button">Table</button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")} type="button">List</button>
        </div>
        <div aria-label="Week" className="lab-chips" role="group">
          {LAB_SURVIVOR_SCENES.map((item) => <button aria-pressed={scene === item.id} key={item.id} onClick={() => setScene(item.id)} type="button">{item.label}</button>)}
        </div>
      </div>

      {view === "list" ? <SurvivorTable data={listData(seats, week)} displayLocked savingDisplay={false} setEliminatedRowsHidden={() => {}} setSurvivorDisplay={() => {}} /> : <div className="lab-table">
        <div className="lab-felt">
          <div className="lab-felt-head">
            <span className="lab-dealer" role="img" aria-label={`Week ${week}`}><small>WEEK</small>{week}</span>
            <p><strong>{alive} of {seats.length}</strong> still in</p>
          </div>
          <div className="lab-layout">
            {(["AFC", "NFC"] as const).map((conference) => <div className="lab-conference" key={conference}>
              <p className="lab-conference-name">{conference}</p>
              {LAB_DIVISIONS.filter((division) => division.conference === conference).map((division) => <div className="lab-division" key={division.name}>
                {division.teams.map((team) => {
                  const box = onBox.get(team);
                  return <div aria-label={`${teamName(team)}${box ? `: ${box.names.join(", ")}${box.lost ? ", lost" : ""}` : ""}`} className={`lab-box ${box ? "has-chips" : ""} ${box?.lost ? "is-swept" : ""}`} key={team} role="img">
                    <Logo size={26} team={team} />
                    {box ? <span className="lab-box-chips">{box.names.slice(0, 3).map((name) => <i key={name}>{name[0]}</i>)}{box.names.length > 3 ? <i>+{box.names.length - 3}</i> : null}</span> : null}
                  </div>;
                })}
              </div>)}
            </div>)}
          </div>
        </div>

        <ol className="lab-seats">
          {seats.map((seat) => <li key={seat.name}>
            <button className={`lab-seat ${seat.out ? "is-out" : ""}`} onClick={() => setOpen(seat.name)} type="button">
              <span className="lab-seat-name">{seat.name}</span>
              <span aria-hidden="true" className="lab-stack">
                {seat.weeks.map((pick) => <span className={`lab-stack-chip ${pick.result === "L" ? "is-lost" : ""}`} key={pick.week}><Logo size={18} team={pick.team} /></span>)}
              </span>
              <span className="lab-seat-status">{seat.out ? `OUT · WEEK ${seat.outWeek}` : `IN · ${seat.weeks.length} ${seat.weeks.length === 1 ? "WEEK" : "WEEKS"}`}</span>
            </button>
          </li>)}
        </ol>
      </div>}

      <Sheet onClose={() => setOpen(null)} open={chosen !== null} title={chosen ? `${chosen.name}'s weeks` : "Weeks"}>
        {chosen ? <ol className="lab-fan">
          {chosen.weeks.map((pick) => <li className={pick.result === "L" ? "is-lost" : ""} key={pick.week}>
            <span className="lab-fan-week">WEEK {pick.week}</span>
            <span className="lab-stack-chip is-large"><Logo size={30} team={pick.team} /></span>
            <span className="lab-fan-team">{teamName(pick.team)}</span>
            <strong>{pick.result === "W" ? "WON" : "LOST"}</strong>
          </li>)}
        </ol> : null}
      </Sheet>
    </section>
  );
}
