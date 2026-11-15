"use client";

import Image from "next/image";
import { useState } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import SurvivorTable, { type SurvivorTableData } from "@/components/survivor-table";
import { LAB_DIVISIONS, LAB_SURVIVOR_LAST_WEEK, LAB_TEAM_NAMES, labSurvivorAt, labSurvivorChampion } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * Lab try-out: the Survivor table, kept simple: one row a player, in standings order.
 *  - Top line: the player, and the team they took this week (WON or LOST once graded). Before kickoff another player's pick reads
 *    "Pick in" and never names the team; a player who has not picked reads "No pick yet"; a player already out reads "Out · week n".
 *  - Bottom line: the teams they used in earlier weeks, in order, and how many teams they have left.
 *  - Tap a row for all 32 teams by division: the ones that player has used are dimmed with the week, the rest are lit.
 * A week stepper shows the table as any week finished; the season ends with one player left, the champion. In the playoffs the
 * table is cleared (Survivor runs through the regular season). The List view shows today's Survivor list from the same data.
 * Sample players only; nothing here reads or writes the pool.
 */

type Week = { week: number; team: string; result: "W" | "L" };
type Seat = { name: string; weeks: Week[]; out: boolean; outWeek: number | null; current: { team: string; result: "W" | "L" } | null };
type Moment = "before" | "gameday" | "graded";
type View = "table" | "list";

const VIEWER = "Walt";
/** In the sample, before kickoff this player has not made this week's pick yet. */
const NOT_PICKED = "June";
const PLAYOFFS = LAB_SURVIVOR_LAST_WEEK + 1;
const DIVISION_ORDER = ["East", "North", "South", "West"];

const teamName = (team: string) => LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES] ?? team;

function Logo({ team, size }: { team: string; size: number }) {
  return <Image alt="" className="lab-felt-logo" height={size} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={size} />;
}

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
  const [view, setView] = useState<View>("table");
  const [week, setWeek] = useState(7);
  const [moment, setMoment] = useState<Moment>("graded");
  const [open, setOpen] = useState<string | null>(null);
  const { seats, graded, alive, champion } = tableAt(week, moment);
  const chosen = seats.find((seat) => seat.name === open) ?? null;
  const playoffs = week >= PLAYOFFS;
  const weekLabel = playoffs ? "Playoffs" : `Week ${week}`;

  return (
    <section aria-label="Survivor table try-out" className="lab-survivor-room" data-view={view}>
      <div className="lab-room-controls lab-survivor-controls">
        <div aria-label="View" className="lab-chips" role="group">
          <button aria-pressed={view === "table"} onClick={() => setView("table")} type="button">Table</button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")} type="button">List</button>
        </div>
        <div aria-label="Week" className="lab-stepper" role="group">
          <button aria-label="Earlier week" disabled={week <= 1} onClick={() => setWeek(week - 1)} type="button">‹</button>
          <strong aria-live="polite">{weekLabel}</strong>
          <button aria-label="Later week" disabled={week >= PLAYOFFS} onClick={() => setWeek(week + 1)} type="button">›</button>
        </div>
        {playoffs ? null : <div aria-label="Moment" className="lab-chips" role="group">
          {([["before", "Before kickoff"], ["gameday", "Game day"], ["graded", "Graded"]] as const).map(([key, label]) => <button aria-pressed={moment === key} key={key} onClick={() => setMoment(key)} type="button">{label}</button>)}
        </div>}
      </div>

      {view === "list" ? <SurvivorTable data={listData(seats, week)} displayLocked savingDisplay={false} setEliminatedRowsHidden={() => {}} setSurvivorDisplay={() => {}} /> : <div className="lab-table">
        <div className={`lab-felt ${playoffs ? "is-cleared" : ""}`}>
          <div className="lab-felt-head">
            <span aria-label={weekLabel} className="lab-dealer" role="img">{playoffs ? <small>PLAY<br />OFFS</small> : <><small>WEEK</small>{week}</>}</span>
            <p className="lab-felt-count">{champion ? <><strong>{champion}</strong> wins Survivor</> : <><strong>{alive} of {seats.length}</strong> alive</>}</p>
          </div>
          {playoffs ? <p className="lab-felt-cleared">Survivor runs through the regular season. {champion ? `${champion} won it in Week ${LAB_SURVIVOR_LAST_WEEK}.` : null}</p> : null}
        </div>

        {playoffs ? null : <ol className="lab-seats">
          {seats.map((seat) => {
            const now = seat.pickThisWeek && !seat.hidden ? seat.pickThisWeek : null;
            const before = seat.weeks.filter((pick) => pick.week < week);
            return <li key={seat.name}>
              <button aria-label={`${seat.name}: teams used and left`} className={`lab-seat ${seat.out ? "is-out" : ""} ${champion === seat.name ? "is-champion" : ""}`} onClick={() => setOpen(seat.name)} type="button">
                <span className="lab-seat-line">
                  <span className="lab-seat-name">{seat.name}{champion === seat.name ? <span aria-label="Champion" className="lab-seat-crown" role="img">👑</span> : null}</span>
                  {now ? <span className={`lab-seat-now ${graded && now.result === "L" ? "is-lost" : ""}`}><span className="lab-stack-chip"><Logo size={18} team={now.team} /></span>{teamName(now.team)}{graded ? <strong>{now.result === "W" ? "WON" : "LOST"}</strong> : null}</span>
                    : seat.hidden ? <span className="lab-seat-now is-quiet">Pick in</span>
                    : seat.noPick ? <span className="lab-seat-now is-quiet">No pick yet</span>
                    : <span className="lab-seat-now is-gone">Out · week {seat.outWeek}</span>}
                </span>
                <span className="lab-seat-line">
                  <span aria-hidden="true" className="lab-seat-used">{before.map((pick) => <span className={`lab-stack-chip ${pick.result === "L" ? "is-lost" : ""}`} key={pick.week}><Logo size={18} team={pick.team} /></span>)}</span>
                  {seat.out ? null : <span className="lab-seat-left">{32 - seat.weeks.length} left</span>}
                </span>
              </button>
            </li>;
          })}
        </ol>}
      </div>}

      <Sheet onClose={() => setOpen(null)} open={chosen !== null} title={chosen ? `${chosen.name}: ${chosen.weeks.length} used${chosen.out ? "" : `, ${32 - chosen.weeks.length} left`}` : "Teams"}>
        {chosen ? <div className="lab-layout lab-left">
          {(["AFC", "NFC"] as const).map((conference) => <div className="lab-conference" key={conference}>
            <p className="lab-conference-name">{conference}</p>
            {DIVISION_ORDER.map((name) => {
              const division = LAB_DIVISIONS.find((item) => item.conference === conference && item.name === name)!;
              return <div className="lab-division" key={name}>
                <span className="lab-division-name">{name.toUpperCase()}</span>
                {division.teams.map((team) => {
                  const used = chosen.weeks.find((pick) => pick.team === team);
                  return <div aria-label={`${teamName(team)}: ${used ? `used in week ${used.week}${used.result === "L" ? ", lost" : ""}` : "left"}`} className={`lab-box ${used ? "is-used" : "is-left"}`} key={team} role="img">
                    <Logo size={26} team={team} />
                    {used ? <small>WK {used.week}</small> : null}
                  </div>;
                })}
              </div>;
            })}
          </div>)}
        </div> : null}
      </Sheet>
    </section>
  );
}
