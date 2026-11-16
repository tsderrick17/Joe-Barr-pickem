"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import type { BoardView } from "@/lib/board-view.js";
import { LAB_VIEWER, LAB_WEEK10_SURVIVOR, labStandard } from "@/lib/lab-clubhouse.js";
import { labBoardView } from "@/lib/lab-board-view.js";
import { labSurvivorChampion, LAB_SURVIVOR_LAST_WEEK } from "@/lib/lab-samples.js";
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

/**
 * The lamp: one for every pick, 1:1 with Pick 1, Pick 2 and Survivor, at the top of your ticket and on the ticket pinned in the
 * clubhouse. The Big Board shows the same colours in the team names themselves.
 *  - dark: no pick. A gold ring with a dark centre: picked on your ticket, not sent yet. Lit yellow: sent, the game not decided.
 *    Green: it won. Red: it lost.
 *  - Survivor's lamp is a poker chip (the dashed rim Survivor wears everywhere in the pool), so it is never taken for a Pick'em pick.
 */
export type LampState = "off" | "picked" | "in" | "won" | "lost";
const LAMP_SAYS: Record<LampState, string> = { off: "no pick", picked: "picked, not sent", in: "in", won: "won", lost: "lost" };
export function Lamp({ state, survivor = false, label }: { state: LampState; survivor?: boolean; label?: string }) {
  return <span aria-label={label ?? LAMP_SAYS[state]} className={`lab-lamp is-${state}${survivor ? " is-survivor" : ""}`} role="img" />;
}
const lampFor = (result: string | null | undefined): LampState => (result === "W" ? "won" : result === "L" ? "lost" : "in");

/* ---------------------------------------------------------------- The Big Board ---------------------------------------------------------------- */

/** What the viewer has sent in: up to two picks against the spread and, while still in Survivor, one team. */
export type Ticket = { picks: string[]; survivor: string | null };

export function Logo({ team, eager = false }: { team: string; eager?: boolean }) {
  return <Image alt="" className="lab-room-logo" height={24} loading={eager ? "eager" : undefined} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={24} />;
}

/** The viewer's picks in kickoff order. */
const inOrder = (view: BoardView, picks: string[]) => view.games.flatMap((game) => picks.filter((team) => team === game.away || team === game.home));
const gameOf = (view: BoardView, team: string) => view.games.find((game) => game.away === team || game.home === team)!;
const lineOf = (view: BoardView, team: string) => { const game = gameOf(view, team); return team === game.away ? game.awayLine : game.homeLine; };

function WeekFace({ view, open }: { view: BoardView; open: (() => void) | null }) {
  const name = (team: string) => view.names[team] ?? team;
  return (
    <table>
      <colgroup><col className="lab-tote-col-wins" /><col />{Array.from({ length: view.maxPicks }, (_, index) => <col className="lab-tote-col-pick" key={index} />)}{view.showSurvivor ? <col className="lab-tote-col-surv" /> : null}</colgroup>
      <thead><tr><th scope="col">W</th><th scope="col">PLAYER</th>{Array.from({ length: view.maxPicks }, (_, index) => <th key={index} scope="col">PICK {index + 1}</th>)}{view.showSurvivor ? <th scope="col"><span aria-hidden="true">SURV</span><span className="sr-only">Survivor</span></th> : null}</tr></thead>
      <tbody>
        {view.rows.map((row) => {
          // Your own row is your ticket as it stands, and is the way in to change it.
          const tap = row.you ? open : null;
          const cell = (label: string, body: ReactNode) => tap ? <button aria-label={label} className="lab-tote-mine" onClick={tap} type="button">{body}</button> : body;
          const survivor = row.survivor;
          return (
            <tr className={row.you ? "is-you" : ""} key={row.id}>
              <td className="lab-tote-wins">{row.wins}</td>
              <th className="lab-tote-name" scope="row">{row.name.toUpperCase()}</th>
              {row.slats.map((slat, index) => (
                <td className="lab-tote-pick" key={index}>
                  {slat === null ? (row.you ? cell(`Pick ${index + 1}: not picked. Open your ticket`, <span className="lab-tote-owed">PICK</span>) : <span aria-label={`Pick ${index + 1}: none yet`} className="lab-tote-none">—</span>)
                    : slat.hidden ? <HiddenPick /> : cell(`Pick ${index + 1}: ${slat.team} ${slat.line}. Open your ticket`, (
                      <span className={`lab-tote-slip ${slat.result ? `is-${slat.result.toLowerCase()}` : ""}`}>
                        <b>{slat.team}</b>
                        <small>{slat.line}</small>
                        <span className="sr-only">{slat.result === "W" ? "win" : slat.result === "L" ? "loss" : "not final"}</span>
                      </span>
                    ))}
                </td>
              ))}
              {view.showSurvivor ? (
                <td className="lab-tote-surv">
                  {view.champion ? (row.id === view.championId ? <span className="lab-tote-won">WON</span> : <span className="lab-tote-out">OUT</span>)
                    : survivor.kind === "out" ? <span className="lab-tote-out">OUT</span>
                    : survivor.kind === "hidden" ? <span aria-label="Survivor pick in, hidden until kickoff" className="lab-tote-in" role="img">IN</span>
                    : survivor.kind === "owed" ? cell("Survivor: not picked. Open your ticket", <span className="lab-tote-owed">PICK</span>)
                    : survivor.kind === "none" ? <span aria-label="Survivor: none yet" className="lab-tote-none">—</span>
                    : cell(`Survivor: ${name(survivor.team)}${row.you ? ". Open your ticket" : ""}`, (
                      <span aria-label={`${name(survivor.team)}${survivor.result === "W" ? ", Survivor win" : survivor.result === "L" ? ", Survivor loss" : ""}`} className={`lab-tote-logo ${survivor.result ? `is-${survivor.result.toLowerCase()}` : ""}`} role="img"><Logo team={survivor.team} /></span>
                    ))}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** What the ticket bar says: the picks still owed (Pick'em, then Survivor while still in it). */
function owedCount(view: BoardView) {
  return Math.max(0, view.maxPicks - view.mine.picks.length) + (view.survivor.playing && !view.mine.survivor ? 1 : 0);
}

/**
 * The tote board: this week's picks for everyone, and (when there is a way to) the bar that opens your ticket. The Lab and the real
 * clubhouse both draw it from a `BoardView`.
 */
export function ToteBoard({ view, onOpen, onSurvivor, onWeek, sent = false }: { view: BoardView; onOpen: () => void; onSurvivor?: () => void; onWeek?: (weekId: string) => void; sent?: boolean }) {
  const owed = owedCount(view);
  const weekText = `${view.week}${view.status ? ` · ${view.status}` : ""}`;
  return (
    <div className="lab-tote">
      <header>
        <h3>PICK’EM</h3>
        {onWeek && view.weeks.length > 1 ? (
          // The week is a button: tapping it opens the phone's own week list (a select laid over the words), and choosing one changes the board.
          <label className="lab-tote-week">
            <span>{weekText} <i aria-hidden="true">▾</i></span>
            <select aria-label="Change week" onChange={(event) => onWeek(event.target.value)} value={view.weekId ?? ""}>
              {view.weeks.map((week) => <option key={week.id} value={week.id}>{week.name}{week.status === "complete" ? " — Final" : ""}</option>)}
            </select>
          </label>
        ) : <span>{weekText}</span>}
      </header>
      {onSurvivor ? (
        <div className="lab-tote-links">
          <span aria-current="page">Big Board</span>
          <button onClick={onSurvivor} type="button">Survivor</button>
        </div>
      ) : null}
      <WeekFace open={view.canPick ? onOpen : null} view={view} />
      {view.canPick ? (
        <button className={`lab-tote-ticket${owed ? " is-owed" : ""}`} onClick={onOpen} type="button">
          <b>{owed ? `${owed} ${owed === 1 ? "PICK" : "PICKS"} OWED` : sent ? "SUBMITTED ✓" : "ALL PICKS IN"}</b>
          <span>{owed ? "Tap to make your picks" : "Tap to change your picks"} ›</span>
        </button>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Your ticket ---------------------------------------------------------------- */

/**
 * Your ticket, opened from your row: the week's games as plain rows, twice. First pick against the spread; then, while you are
 * still in Survivor, pick one team straight up from the same rows, the teams you have used marked. One Submit. `onSubmit` may answer
 * with a message when the pick could not be saved, which is shown under the button.
 */
/** What a decided side says about itself: its final score, and whether it covered its line and by how much (a push counts as a miss). */
function coverNote(result: BoardView["games"][number]["results"][string]) {
  const covered = result.ats === "W";
  const size = result.margin === null ? "" : ` ${Math.abs(result.margin)}`;
  return { score: result.score, covered, says: covered ? `COVERED BY${size}`.trim() : result.margin === 0 ? "PUSH · A MISS" : `MISSED BY${size}`.trim() };
}

export function TicketForm({ view, onSubmit, poolAction, onPoolAction }: { view: BoardView; onSubmit: (ticket: Ticket) => void | string | Promise<void | string>; poolAction?: boolean; onPoolAction?: (on: boolean) => void }) {
  // The Slate's All games / Pool action: Pool action leaves out a game that has kicked off with nobody's pick in it. Saved the Slate's way when `onPoolAction` is given.
  const [localAction, setLocalAction] = useState(view.poolAction);
  const actionOnly = poolAction ?? localAction;
  const chooseAction = (on: boolean) => { setLocalAction(on); onPoolAction?.(on); };
  const shownGames = actionOnly ? view.games.filter((game) => game.action) : view.games;
  const [picks, setPicks] = useState(view.mine.picks);
  const [chip, setChip] = useState(view.mine.survivor);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const survivor = view.survivor;
  const pickingSurvivor = survivor.playing;
  const [mode, setMode] = useState<"pickem" | "survivor">("pickem");
  const name = (team: string) => view.names[team] ?? team;
  const cap = view.maxPicks;

  const choose = (team: string, gameId: string) => {
    const game = view.games.find((item) => item.id === gameId)!;
    const other = team === game.home ? game.away : game.home;
    if (picks.includes(team)) { setPicks(picks.filter((pick) => pick !== team)); return; }
    if (picks.length >= cap && !picks.includes(other)) return;
    const next = [...picks.filter((pick) => pick !== other), team];
    setPicks(next);
    // The last pick moves you on to Survivor, if it is still to do.
    if (next.length === cap && pickingSurvivor && !chip && !picks.includes(other)) setMode("survivor");
  };

  const ordered = inOrder(view, picks);
  const lines = [...Array.from({ length: cap }, (_, index) => ({ label: `Pick ${index + 1}`, value: ordered[index] ? `${ordered[index]} ${lineOf(view, ordered[index])}` : null })), ...(pickingSurvivor ? [{ label: "Survivor", value: chip ? name(chip) : null }] : [])];
  // A lamp for every pick, in the ticket's own order: dark until picked, a ring while it is only on the ticket, lit once sent, then
  // green or red when its game is decided.
  const lampOf = (team: string | undefined, sentTeams: Array<string | null>, graded: (team: string) => string | null): LampState =>
    !team ? "off" : !sentTeams.includes(team) ? "picked" : lampFor(graded(team));
  const atsNow = (team: string) => gameOf(view, team).results[team].ats;
  const winNow = (team: string) => gameOf(view, team).results[team].su;
  const lamps: Array<{ label: string; state: LampState; survivor?: boolean }> = [
    ...Array.from({ length: cap }, (_, index) => ({ label: `Pick ${index + 1}`, state: lampOf(ordered[index], view.mine.picks, atsNow) })),
    ...(pickingSurvivor ? [{ label: "Survivor", state: lampOf(chip ?? undefined, [view.mine.survivor], winNow), survivor: true }] : []),
  ];
  const hasSent = view.mine.picks.length > 0 || Boolean(view.mine.survivor);
  const changed = ordered.join() !== inOrder(view, view.mine.picks).join() || (pickingSurvivor && chip !== view.mine.survivor);

  async function send() {
    setSending(true);
    setProblem("");
    try {
      const answer = await onSubmit({ picks: ordered, survivor: pickingSurvivor ? chip : null });
      if (typeof answer === "string") setProblem(answer);
    } finally { setSending(false); }
  }

  return (
    <div className="lab-bigboard is-tote trace-gilt lab-window">
      <header>
        <h3>{view.week}</h3>
        <ul aria-label="Your picks" className="lab-lamps">
          {lamps.map((lamp) => <li key={lamp.label}><Lamp label={`${lamp.label}: ${LAMP_SAYS[lamp.state]}`} state={lamp.state} survivor={lamp.survivor} /><small aria-hidden="true">{lamp.survivor ? "SURV" : lamp.label.replace("Pick ", "P")}</small></li>)}
        </ul>
      </header>

      <div aria-label="Games shown" className="lab-chips lab-ticket-switch lab-ticket-action" role="group">
        <button aria-pressed={!actionOnly} onClick={() => chooseAction(false)} type="button">All games</button>
        <button aria-pressed={actionOnly} onClick={() => chooseAction(true)} type="button">Pool action</button>
      </div>

      {pickingSurvivor ? (
        <div aria-label="What to pick" className="lab-chips lab-ticket-switch" role="group">
          <button aria-pressed={mode === "pickem"} onClick={() => setMode("pickem")} type="button">Pick’em<small>pick {cap} vs. the spread</small></button>
          <button aria-pressed={mode === "survivor"} onClick={() => setMode("survivor")} type="button">Survivor<small>pick 1 · {survivor.left} teams left</small></button>
        </div>
      ) : null}
      {survivor.out && !view.champion ? <p className="lab-window-out">You’re out of Survivor{survivor.outWeek ? ` (lost in week ${survivor.outWeek})` : ""}. The pool goes on: follow it at the Survivor table.</p> : null}

      <section aria-label={mode === "survivor" ? "Survivor" : "Pick’em"} className="lab-window-part">
        {shownGames.length === 0 ? <p className="lab-board-note">No pool action in this week’s games yet. Switch to All games to see them.</p> : null}
        <ol>
          {shownGames.map((game) => {
            const locked = game.kickedOff;
            const cell = (team: string) => {
              if (mode === "survivor") {
                const entry = survivor.teams[team];
                const picked = chip === team;
                return (
                  <button aria-label={name(team)} aria-pressed={picked} className={`lab-board-cell is-survivor ${picked ? "is-picked" : ""} ${entry.free ? "" : "is-locked"}`} disabled={!entry.free} onClick={() => { setChip(picked ? null : team); }} type="button">
                    <span className="lab-board-team"><Logo team={team} />{team}</span>
                    <span className="lab-board-used">{entry.usedWeek ? `USED WK ${entry.usedWeek}` : entry.used ? "USED" : entry.locked ? "KICKED OFF" : picked ? "YOUR PICK" : ""}</span>
                    <span aria-hidden="true" className="lab-board-trace" />
                  </button>
                );
              }
              const picked = picks.includes(team);
              const line = team === game.away ? game.awayLine : game.homeLine;
              const result = game.results[team];
              // Once a game is decided each side shows its final score and how it did against the spread, so who covered is plain.
              const final = result.ats !== null && result.score !== null ? coverNote(result) : null;
              return (
                <button aria-label={`${name(team)} ${line}${final ? `, final ${final.score}, ${final.says.toLowerCase()}` : ""}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} onClick={() => choose(team, game.id)} type="button">
                  <span className="lab-board-team"><Logo team={team} />{team}</span>
                  <span className="lab-board-line">{line}</span>
                  {final ? <span className={`lab-board-final ${final.covered ? "is-covered" : ""}`}><b>{final.score}</b><em>{final.says}</em></span> : null}
                  <span aria-hidden="true" className="lab-board-trace" />
                </button>
              );
            };
            return (
              <li key={game.id}>
                <span className="lab-board-time">{game.kickoff.toUpperCase()}{game.kickedOff ? " · KICKED OFF" : ""}</span>
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
        <button className="lab-window-submit" disabled={!changed || sending} onClick={() => void send()} type="button">
          {sending ? "Sending…" : changed ? (hasSent ? "Submit changes" : "Submit picks") : hasSent ? "Submitted ✓" : "Submit picks"}
        </button>
        {problem ? <p className="lab-window-problem" role="alert">{problem}</p> : null}
        <p className="lab-board-note">{view.champion ? `Survivor is decided: ${view.champion} won it.` : "Tap a team to pick it; tap again to take it back. Change any pick until its game kicks off."}</p>
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
export function BigBoardRoom({ survivorIn = true, startOpen = false, onTicket, onSurvivor }: { survivorIn?: boolean; startOpen?: boolean; onTicket?: (allIn: boolean) => void; onSurvivor?: () => void }) {
  const [scene, setSceneOnly] = useState<Scene>("before");
  const [ticket, setTicket] = useState<Ticket>(() => sampleTicket(LAB_VIEWER, survivorIn));
  const [open, setOpen] = useState(startOpen);
  const [sent, setSent] = useState(false);
  // "Out of Survivor" is seen as Hank, who lost in week 3; everything else as Walt.
  const viewer = scene === "out" ? "Hank" : LAB_VIEWER;
  const moment = scene === "gameday" || scene === "graded" ? scene : "before";
  const champion = scene === "over" ? labSurvivorChampion(LAB_SURVIVOR_LAST_WEEK) : null;
  const view = labBoardView({ moment, viewer, ticket, champion });
  const canPick = view.canPick;

  function setScene(next: Scene) {
    setSceneOnly(next);
    setTicket(sampleTicket(next === "out" ? "Hank" : LAB_VIEWER, next === "before" ? survivorIn : true));
    setSent(false);
  }
  function submit(next: Ticket) {
    setTicket(next);
    setOpen(false);
    setSent(true);
    onTicket?.(next.picks.length === 2 && (!view.survivor.playing || Boolean(next.survivor)));
  }

  return (
    <div className="lab-room-stack">
      <Chips label="Moment" onChange={setScene} options={SCENES} value={scene} />
      <ToteBoard onOpen={() => setOpen(true)} onSurvivor={onSurvivor} sent={sent} view={view} />
      <Sheet onClose={() => setOpen(false)} open={open && canPick} title="Your ticket">
        <TicketForm onSubmit={submit} view={view} />
      </Sheet>
    </div>
  );
}
