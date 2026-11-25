"use client";

import { haptic } from "@/lib/haptics-client";
import type { ReactNode } from "react";
import type { BoardView } from "@/lib/board-view.js";
import { HiddenPick, Logo, NoPick } from "@/components/clubhouse/lamps";
import PlayerTrophyName from "@/components/player-trophy-name";

/**
 * The tote board family, the owner's pick of the Pad skins, as the clubhouse's main piece. Drawn from a `BoardView` (the real clubhouse) or the Lab's sample one.
 *  - The Big Board: everyone's picks in one place, as the Pick'em Pad is today (wins, player, Pick 1, Pick 2, no place), with
 *    Survivor's chips in their own column. The standings fold into the same board: one tap turns it to the season table.
 *  - The board is where you pick. Tap the ticket bar under it (or your own row; the board does not mark whose row it is) and the
 *    ticket opens over the board: this week's games as plain rows, pick two against the
 *    spread, then (while you are still in Survivor) the same games again as plain rows to pick one team straight up, the teams you
 *    have used marked with their week. One Submit sends all of it, and your row on the board shows it. There is no separate screen
 *    for picking. Survivor stays on the ticket for as long as the Survivor pool is going, read only for a player who is out.
 * A pick that is made but not shown yet is dark lamps and a green IN; another player's pick stays covered until its game kicks off.
 */

/** What the viewer has sent in: up to two picks against the spread and, while still in Survivor, one team. */
export type Ticket = { picks: string[]; survivor: string | null };

/** The viewer's picks in kickoff order. */
export const inOrder = (view: BoardView, picks: string[]) => view.games.flatMap((game) => picks.filter((team) => team === game.away || team === game.home));
export const gameOf = (view: BoardView, team: string) => view.games.find((game) => game.away === team || game.home === team)!;
export const lineOf = (view: BoardView, team: string) => { const game = gameOf(view, team); return team === game.away ? game.awayLine : game.homeLine; };

/**
 * A playoff round's face: a pick for every game, so each game is a column headed by its two teams, and a pick is the team's logo under
 * its game (lit green or red once decided, one lit lamp while another player's pick is hidden, PICK where yours is owed). Under each
 * name, the race: how far back of the leader, or OUT / FORFEITED (the row greyed and struck through).
 */
function PlayoffFace({ view, open }: { view: BoardView; open: (() => void) | null }) {
  const name = (team: string) => view.names[team] ?? team;
  return (
    <table className="is-playoff">
      <colgroup><col className="lab-tote-col-wins" /><col />{view.games.map((game) => <col className="lab-tote-col-game" key={game.id} />)}</colgroup>
      <thead><tr><th scope="col">W</th><th scope="col">PLAYER</th>{view.games.map((game) => <th className="lab-tote-game" key={game.id} scope="col"><span>{game.away}</span><span>{game.home}</span></th>)}</tr></thead>
      <tbody>
        {view.rows.map((row) => {
          const tap = row.you ? open : null;
          const cell = (label: string, body: ReactNode) => tap ? <button aria-label={label} className="lab-tote-mine" onClick={tap} type="button">{body}</button> : body;
          const standing = row.forfeited ? "FORFEITED" : row.out ? "OUT" : row.back === 0 ? "LEADS" : row.back ? `${row.back} BACK` : "";
          return (
            <tr className={`${row.you ? "is-you" : ""}${row.out || row.forfeited ? " is-out" : ""}`} key={row.id}>
              <td className="lab-tote-wins">{row.wins}</td>
              <th className="lab-tote-name" scope="row"><span className="lab-tote-player"><PlayerTrophyName name={row.name.toUpperCase()} showTrophy={Boolean(row.holdsTrophy)} titles={row.trophies} /></span>{standing ? <small>{standing}</small> : null}</th>
              {view.games.map((game, index) => {
                const slat = row.slats[index];
                const matchup = `${name(game.away)} at ${name(game.home)}`;
                return (
                  <td className="lab-tote-surv" key={game.id}>
                    {slat === null ? (row.you && !game.kickedOff && !row.out && !row.forfeited ? cell(`${matchup}: not picked. Open your ticket`, <span className="lab-tote-owed-ring">PICK</span>) : <NoPick label={`${matchup}: no pick`} />)
                      : slat.hidden || !slat.team ? <HiddenPick />
                      : cell(`${matchup}: ${name(slat.team)} ${slat.line ?? ""}${slat.result === "W" ? ", won" : slat.result === "L" ? ", lost" : ""}${row.you ? ". Open your ticket" : ""}`, (
                        <span className={`lab-tote-logo ${slat.result ? `is-${slat.result.toLowerCase()}` : ""}`} role="img" aria-label={name(slat.team)}><Logo team={slat.team} /></span>
                      ))}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The race in a line: who leads, and where you stand (or that your score stands). */
function raceLine(view: BoardView) {
  const race = view.playoff;
  if (!race) return null;
  const leaders = race.leaders.length === 1 ? `${race.leaders[0]} leads with ${race.leaderWins}` : race.leaders.length > 1 ? `${race.leaders.length} tied for the lead at ${race.leaderWins}` : "";
  const you = race.you.forfeited ? "You forfeited; your score stands" : race.you.out ? "You can no longer catch the leader; your score stands" : race.you.back === 0 ? "You lead" : race.you.back ? `You: ${race.you.back} back` : "";
  return [leaders, you].filter(Boolean).join(" · ");
}

function WeekFace({ view, open }: { view: BoardView; open: (() => void) | null }) {
  const name = (team: string) => view.names[team] ?? team;
  if (view.playoff) return <PlayoffFace open={open} view={view} />;
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
              <th className="lab-tote-name" scope="row"><PlayerTrophyName name={row.name.toUpperCase()} showTrophy={Boolean(row.holdsTrophy)} titles={row.trophies} /></th>
              {row.slats.map((slat, index) => (
                <td className="lab-tote-pick" key={index}>
                  {slat === null ? (row.you ? cell(`Pick ${index + 1}: not picked. Open your ticket`, <span className="lab-tote-owed">PICK</span>) : <NoPick label={`Pick ${index + 1}: none yet`} />)
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
                    : survivor.kind === "hidden" ? <HiddenPick label="Survivor pick in, hidden until kickoff" survivor />
                    : survivor.kind === "owed" ? cell("Survivor: not picked. Open your ticket", <span className="lab-tote-owed">PICK</span>)
                    : survivor.kind === "none" ? <NoPick label="Survivor: none yet" survivor />
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
  // A playoff round owes a pick for every game still to kick off that has none.
  if (view.playoff) return view.games.filter((game) => !game.kickedOff && !view.mine.picks.some((team) => team === game.away || team === game.home)).length;
  return Math.max(0, view.maxPicks - view.mine.picks.length) + (view.survivor.playing && !view.mine.survivor ? 1 : 0);
}

/**
 * The tote board: this week's picks for everyone, and (when there is a way to) the bar that opens your ticket. The Lab and the real
 * clubhouse both draw it from a `BoardView`.
 */
/**
 * The week as a button: tapping it opens the phone's own week list (a select laid over the words), and choosing one changes the board.
 * With `step`, arrows either side go to the week before and after, so the weeks can be flipped through one at a time.
 */
export function WeekChoice({ view, onWeek, text, step = false }: { view: BoardView; onWeek: (weekId: string) => void; text: string; step?: boolean }) {
  const at = view.weeks.findIndex((week) => week.id === view.weekId);
  const before = at > 0 ? view.weeks[at - 1] : null;
  const after = at >= 0 && at < view.weeks.length - 1 ? view.weeks[at + 1] : null;
  const label = (
    <label className="lab-tote-week">
      <span>{text} <i aria-hidden="true">▾</i></span>
      <select aria-label="Change week" onChange={(event) => { haptic("tick"); onWeek(event.target.value); }} value={view.weekId ?? ""}>
        {view.weeks.map((week) => <option key={week.id} value={week.id}>{week.name}{week.status === "complete" ? " — Final" : ""}</option>)}
      </select>
    </label>
  );
  if (!step) return label;
  return (
    <div className="lab-week-step">
      <button aria-label={before ? `Back to ${before.name}` : "No earlier week"} disabled={!before} onClick={() => { if (before) { haptic("tick"); onWeek(before.id); } }} type="button"><i aria-hidden="true" /></button>
      {label}
      <button aria-label={after ? `On to ${after.name}` : "No later week"} disabled={!after} onClick={() => { if (after) { haptic("tick"); onWeek(after.id); } }} type="button"><i aria-hidden="true" /></button>
    </div>
  );
}

/**
 * `savedAt`: when this player's picks for the week on the board were last saved here ("7:42 PM"), so the bar can say they are safe.
 */
export function ToteBoard({ view, onOpen, onSurvivor, onWeek, sent = false, savedAt = null }: { view: BoardView; onOpen: () => void; onSurvivor?: () => void; onWeek?: (weekId: string) => void; sent?: boolean; savedAt?: string | null }) {
  const owed = owedCount(view);
  const weekText = `${view.week}${view.status ? ` · ${view.status}` : ""}`;
  return (
    <div className="lab-tote">
      <header>
        <h3>PICK’EM</h3>
        {onWeek && view.weeks.length > 1 ? <WeekChoice onWeek={onWeek} text={weekText} view={view} /> : <span>{weekText}</span>}
      </header>
      {onSurvivor ? (
        <div className="lab-tote-links">
          <span aria-current="page">Big Board</span>
          <button onClick={() => { haptic("tick"); onSurvivor(); }} type="button">Survivor</button>
        </div>
      ) : null}
      {view.playoff ? <p className="lab-tote-race">{raceLine(view)}</p> : null}
      <div className="lab-tote-data"><WeekFace open={view.canPick ? onOpen : null} view={view} /></div>
      {view.canPick ? (
        <button className={`lab-tote-ticket${owed ? " is-owed" : ""}`} onClick={() => { haptic("tick"); onOpen?.(); }} type="button">
          {/* Set like the heading of your ticket in the room: a small word over what is left to do, and (once saved) when, on the right. */}
          <span className="lab-tote-ticket-body">
            <span className="lab-tote-ticket-title">
              <i>Your ticket</i>
              <b>{owed ? <><em>{owed}</em> {owed === 1 ? "PICK TO MAKE" : "PICKS TO MAKE"}</> : savedAt ? "PICKS SAVED" : sent ? "SUBMITTED" : "ALL PICKS IN"}</b>
            </span>
            {!owed && savedAt ? <span className="lab-tote-ticket-note"><i>Saved</i>{savedAt}</span> : null}
            {!owed && !savedAt ? <span className="lab-tote-ticket-note"><i>Change</i>until kickoff</span> : null}
          </span>
          <span aria-hidden="true" className="lab-tote-ticket-stub">{owed ? "PICK" : "VIEW"}<i /></span>
        </button>
      ) : null}
    </div>
  );
}
