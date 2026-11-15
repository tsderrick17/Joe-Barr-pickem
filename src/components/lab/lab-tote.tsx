"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { LAB_VIEWER, LAB_WEEK10_SURVIVOR, labKickedOff, labLeaderboard, labStandard, labSurvivorBoard } from "@/lib/lab-clubhouse.js";
import { LAB_SLATE, LAB_TEAM_NAMES, labAtsResult, labLineFor, labSurvivorAt, labSurvivorChampion, LAB_SURVIVOR_LAST_WEEK } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * The tote board family, the owner's pick of the Pad skins, as the clubhouse's main piece. Sample players only.
 *  - The Big Board: everyone's picks in one place, as the Pick'em Pad is today (wins, player, Pick 1, Pick 2, no place), with
 *    Survivor's chips in their own column. The standings fold into the same board: one tap turns it to the season table.
 *  - The board is where you pick. Tap the ticket bar under it (or your own row; the board does not mark whose row it is) and the
 *    ticket opens over the board: this week's games as plain rows, pick two against the
 *    spread, then (while you are still in Survivor) the same games again as plain rows to pick one team straight up, the teams you
 *    have used marked with their week. One Submit sends all of it, and your row on the board shows it. There is no separate screen
 *    for picking. Survivor stays on the ticket for as long as the Survivor pool is going, read only for a player who is out.
 * A pick that is made but not shown yet is dark lamps and a green IN; another player's pick stays covered until its game kicks off.
 */

const teamName = (team: string) => LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES];

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="lab-chips" role="group">
      {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
    </div>
  );
}

/** A pick that is in but not shown yet: it reads as made, never as empty, and never says which team. */
function HiddenPick() {
  return (
    <span aria-label="Pick in, hidden until kickoff" className="lab-tote-cover" role="img">
      <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
    </span>
  );
}

/* ---------------------------------------------------------------- The Big Board ---------------------------------------------------------------- */

/** What the viewer has sent in: up to two picks against the spread and, while still in Survivor, one team. */
export type Ticket = { picks: string[]; survivor: string | null };
type Mine = { name: string; ticket: Ticket; open: (() => void) | null; champion: string | null };

const gameOf = (team: string) => LAB_SLATE.find((game) => game.away === team || game.home === team)!;
/** Survivor is straight up: the team has to win its game, and a tie is a loss. */
const straightUp = (game: (typeof LAB_SLATE)[number], team: string) => { const final = game.final as unknown as Record<string, number>; return final[team] > final[team === game.home ? game.away : game.home] ? "W" : "L"; };
/** The viewer's picks in kickoff order. */
const inOrder = (picks: string[]) => LAB_SLATE.flatMap((game) => picks.filter((team) => team === game.away || team === game.home));

function WeekFace({ moment, mine }: { moment: string; mine: Mine }) {
  const rows = labLeaderboard({ round: "regular", moment });
  return (
    <table>
      <colgroup><col className="lab-tote-col-wins" /><col /><col className="lab-tote-col-pick" /><col className="lab-tote-col-pick" /><col className="lab-tote-col-surv" /></colgroup>
      <thead><tr><th scope="col">W</th><th scope="col">PLAYER</th><th scope="col">PICK 1</th><th scope="col">PICK 2</th><th scope="col"><span aria-hidden="true">SURV</span><span className="sr-only">Survivor</span></th></tr></thead>
      <tbody>
        {rows.map((row) => {
          const you = row.name === mine.name;
          const standard = labStandard(row.name, { round: "regular", moment, viewer: mine.name });
          // Your own row shows your ticket as it stands, and is the way in to change it.
          const yours = inOrder(mine.ticket.picks).map((team) => { const game = gameOf(team); return { gameId: game.id, hidden: false, team, line: labLineFor(game, team), result: labKickedOff(LAB_SLATE, game.id, moment) ? labAtsResult(game, team) : null }; });
          const slats = you ? [yours[0] ?? null, yours[1] ?? null] : standard.slats;
          const survivorGame = you && mine.ticket.survivor ? gameOf(mine.ticket.survivor) : null;
          const survivor = !you ? standard.survivor : labSurvivorBoard({ moment, viewer: mine.name }).out ? null
            : { team: mine.ticket.survivor, hidden: false, result: survivorGame && mine.ticket.survivor && labKickedOff(LAB_SLATE, survivorGame.id, moment) ? straightUp(survivorGame, mine.ticket.survivor) : null };
          const tap = you ? mine.open : null;
          const cell = (label: string, body: ReactNode) => tap ? <button aria-label={label} className="lab-tote-mine" onClick={tap} type="button">{body}</button> : body;
          return (
            <tr className={you ? "is-you" : ""} key={row.name}>
              <td className="lab-tote-wins">{row.wins}</td>
              <th className="lab-tote-name" scope="row">{row.name.toUpperCase()}</th>
              {slats.map((slat, index) => (
                <td className="lab-tote-pick" key={slat?.gameId ?? `empty-${index}`}>
                  {slat === null ? cell(`Pick ${index + 1}: not picked. Open your ticket`, <span className="lab-tote-owed">PICK</span>)
                    : slat.hidden ? <HiddenPick /> : cell(`Pick ${index + 1}: ${slat.team} ${slat.line}. Open your ticket`, (
                      <span className={`lab-tote-slip ${slat.result ? `is-${slat.result.toLowerCase()}` : ""}`}>
                        <b>{slat.team}</b>
                        <small>{slat.line}</small>
                        <span className="sr-only">{slat.result === "W" ? "win" : slat.result === "L" ? "loss" : "not final"}</span>
                      </span>
                    ))}
                </td>
              ))}
              <td className="lab-tote-surv">
                {mine.champion ? (row.name === mine.champion ? <span className="lab-tote-won">WON</span> : <span className="lab-tote-out">OUT</span>)
                  : survivor === null ? <span className="lab-tote-out">OUT</span>
                  : survivor.hidden ? <span aria-label="Survivor pick in, hidden until kickoff" className="lab-tote-in" role="img">IN</span>
                  : !survivor.team ? (you ? cell("Survivor: not picked. Open your ticket", <span className="lab-tote-owed">PICK</span>) : <span aria-label="Survivor pick in, hidden until kickoff" className="lab-tote-in" role="img">IN</span>)
                  : cell(`Survivor: ${teamName(survivor.team)}${you ? ". Open your ticket" : ""}`, (
                    <span aria-label={`${teamName(survivor.team)}${survivor.result === "W" ? ", Survivor win" : survivor.result === "L" ? ", Survivor loss" : ""}`} className={`lab-tote-logo ${survivor.result ? `is-${survivor.result.toLowerCase()}` : ""}`} role="img"><Logo team={survivor.team} /></span>
                  ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------------------------------------------------------------- Your ticket ---------------------------------------------------------------- */

export function Logo({ team, eager = false }: { team: string; eager?: boolean }) {
  return <Image alt="" className="lab-room-logo" height={24} loading={eager ? "eager" : undefined} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={24} />;
}

/**
 * Your ticket, opened from your row: the week's games as plain rows, twice. First pick two against the spread; then, while you are
 * still in Survivor, pick one team straight up from the same rows, the teams you have used marked with their week. One Submit.
 */
function TicketForm({ viewer, moment, champion, ticket, onSubmit }: { viewer: string; moment: string; champion: string | null; ticket: Ticket; onSubmit: (ticket: Ticket) => void }) {
  const [picks, setPicks] = useState(ticket.picks);
  const [chip, setChip] = useState(ticket.survivor);
  const survivor = { ...labSurvivorBoard({ moment, viewer }), used: labSurvivorAt(9).find((seat) => seat.name === viewer)?.weeks.length ?? 0 };
  const pickingSurvivor = !champion && !survivor.out;
  const [mode, setMode] = useState<"pickem" | "survivor">("pickem");

  const choose = (team: string, gameId: string) => {
    const game = LAB_SLATE.find((item) => item.id === gameId)!;
    const other = team === game.home ? game.away : game.home;
    if (picks.includes(team)) { setPicks(picks.filter((pick) => pick !== team)); return; }
    if (picks.length >= 2 && !picks.includes(other)) return;
    const next = [...picks.filter((pick) => pick !== other), team];
    setPicks(next);
    // The second pick moves you on to Survivor, if it is still to do.
    if (next.length === 2 && pickingSurvivor && !chip && !picks.includes(other)) setMode("survivor");
  };

  const ordered = inOrder(picks).map((team) => `${team} ${labLineFor(gameOf(team), team)}`);
  const lines = [{ label: "Pick 1", value: ordered[0] ?? null }, { label: "Pick 2", value: ordered[1] ?? null }, ...(pickingSurvivor ? [{ label: "Survivor", value: chip ? teamName(chip) : null }] : [])];
  const made = lines.filter((line) => line.value).length;
  const changed = inOrder(picks).join() !== inOrder(ticket.picks).join() || (pickingSurvivor && chip !== ticket.survivor);

  return (
    <div className="lab-bigboard is-tote trace-gilt lab-window">
      <header><h3>WEEK 10</h3><span>{made} OF {lines.length} PICKED</span></header>

      {pickingSurvivor ? (
        <div aria-label="What to pick" className="lab-chips lab-ticket-switch" role="group">
          <button aria-pressed={mode === "pickem"} onClick={() => setMode("pickem")} type="button">Pick 2<small>against the spread</small></button>
          <button aria-pressed={mode === "survivor"} onClick={() => setMode("survivor")} type="button">Survivor<small>{32 - survivor.used} teams left</small></button>
        </div>
      ) : null}
      {survivor.out && !champion ? <p className="lab-window-out">You’re out of Survivor (lost in week {survivor.outWeek}). The pool goes on: follow it at the Survivor table.</p> : null}

      <section aria-label={mode === "survivor" ? "Survivor" : "Pick’em"} className="lab-window-part">
        <h4>{mode === "survivor" ? <>SURVIVOR <small>pick 1 team to win its game</small></> : <>PICK’EM <small>pick 2 against the spread</small></>}</h4>
        <ol>
          {LAB_SLATE.map((game) => {
            const locked = labKickedOff(LAB_SLATE, game.id, moment);
            const cell = (team: string) => {
              if (mode === "survivor") {
                const entry = survivor.teams.find((item) => item.team === team)!;
                const picked = chip === team;
                return (
                  <button aria-label={teamName(team)} aria-pressed={picked} className={`lab-board-cell is-survivor ${picked ? "is-picked" : ""} ${entry.free ? "" : "is-locked"}`} disabled={!entry.free} onClick={() => { setChip(picked ? null : team); }} type="button">
                    <span className="lab-board-team"><Logo team={team} />{team}</span>
                    <span className="lab-board-used">{entry.usedWeek ? `USED WK ${entry.usedWeek}` : entry.locked ? "KICKED OFF" : picked ? "YOUR PICK" : ""}</span>
                    <span aria-hidden="true" className="lab-board-trace" />
                  </button>
                );
              }
              const picked = picks.includes(team);
              return (
                <button aria-label={`${teamName(team)} ${labLineFor(game, team)}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} onClick={() => choose(team, game.id)} type="button">
                  <span className="lab-board-team"><Logo team={team} />{team}</span>
                  <span className="lab-board-line">{labLineFor(game, team)}</span>
                  {locked ? <span aria-label="Kicked off" className="lab-board-lock" role="img">🔒</span> : null}
                  <span aria-hidden="true" className="lab-board-trace" />
                </button>
              );
            };
            return (
              <li key={game.id}>
                <span className="lab-board-time">{game.kickoff.toUpperCase()}{labKickedOff(LAB_SLATE, game.id, moment) ? " · KICKED OFF" : ""}</span>
                {cell(game.away)}
                <span aria-hidden="true" className="lab-board-at">@</span>
                {cell(game.home)}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Your ticket" className="lab-window-ticket">
        <dl>
          {lines.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{line.value ?? "—"}</dd></div>)}
        </dl>
        <button className="lab-window-submit" disabled={!changed} onClick={() => onSubmit({ picks: inOrder(picks), survivor: pickingSurvivor ? chip : null })} type="button">
          {changed ? (ticket.picks.length || ticket.survivor ? "Submit changes" : "Submit picks") : "Submitted ✓"}
        </button>
        <p className="lab-board-note">{champion ? `Survivor is decided: ${champion} won it.` : "Tap a team to pick it; tap again to take it back. Change any pick until its game kicks off."}</p>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- The room ---------------------------------------------------------------- */

type Scene = "before" | "gameday" | "graded" | "out" | "over";
const SCENES: ReadonlyArray<readonly [Scene, string]> = [["before", "Before kickoff"], ["gameday", "Game day"], ["graded", "Graded"], ["out", "Out of Survivor"], ["over", "Survivor decided"]];

/** What a player has in at the start of a sample scene: both picks, and the Survivor team unless one is still owed. */
function sampleTicket(viewer: string, survivorIn: boolean): Ticket {
  const picks = labStandard(viewer, { round: "regular", moment: "before", viewer }).slats.map((slat) => slat.team as string);
  return { picks, survivor: survivorIn ? (LAB_WEEK10_SURVIVOR as Record<string, string>)[viewer] ?? null : null };
}

/**
 * The Big Board with the Lab's moment chips above it. Your row is your ticket: tap it to pick or change. `survivorIn` false starts with
 * the Survivor pick still owed; `startOpen` opens the ticket at once (the room's picks wall and pinned ticket lead here);
 * `onTicket` hears whether every pick is in.
 */
export function BigBoardRoom({ survivorIn = true, startOpen = false, onTicket }: { survivorIn?: boolean; startOpen?: boolean; onTicket?: (allIn: boolean) => void }) {
  const [scene, setSceneOnly] = useState<Scene>("before");
  const [ticket, setTicket] = useState<Ticket>(() => sampleTicket(LAB_VIEWER, survivorIn));
  const [open, setOpen] = useState(startOpen);
  const [sent, setSent] = useState(false);
  // "Out of Survivor" is seen as Hank, who lost in week 3; everything else as Walt.
  const viewer = scene === "out" ? "Hank" : LAB_VIEWER;
  const moment = scene === "gameday" || scene === "graded" ? scene : "before";
  const champion = scene === "over" ? labSurvivorChampion(LAB_SURVIVOR_LAST_WEEK) : null;
  const canPick = scene !== "graded";
  const needsSurvivor = !champion && !labSurvivorBoard({ moment, viewer }).out;
  const owed = (2 - ticket.picks.length) + (needsSurvivor && !ticket.survivor ? 1 : 0);

  function setScene(next: Scene) {
    setSceneOnly(next);
    setTicket(sampleTicket(next === "out" ? "Hank" : LAB_VIEWER, next === "before" ? survivorIn : true));
    setSent(false);
  }
  function submit(next: Ticket) {
    setTicket(next);
    setOpen(false);
    setSent(true);
    onTicket?.(next.picks.length === 2 && (!needsSurvivor || Boolean(next.survivor)));
  }

  return (
    <div className="lab-room-stack">
      <Chips label="Moment" onChange={setScene} options={SCENES} value={scene} />
      <div className="lab-tote">
        <header><h3>PICK’EM</h3><span>WEEK 10 · OFFICIAL</span></header>
        <WeekFace mine={{ name: viewer, ticket, open: canPick ? () => setOpen(true) : null, champion }} moment={moment} />
        {canPick ? (
          <button className={`lab-tote-ticket${owed ? " is-owed" : ""}`} onClick={() => setOpen(true)} type="button">
            <b>{owed ? `${owed} ${owed === 1 ? "PICK" : "PICKS"} OWED` : sent ? "SUBMITTED ✓" : "ALL PICKS IN"}</b>
            <span>{owed ? "Tap to make your picks" : "Tap to change your picks"} ›</span>
          </button>
        ) : null}
      </div>
      <Sheet onClose={() => setOpen(false)} open={open && canPick} title="Your ticket">
        <TicketForm champion={champion} moment={moment} onSubmit={submit} ticket={ticket} viewer={viewer} />
      </Sheet>
    </div>
  );
}
