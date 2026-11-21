"use client";

import Image from "next/image";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import type { BoardView } from "@/lib/board-view.js";
import { LAB_VIEWER, LAB_WEEK10_SURVIVOR, labStandard } from "@/lib/lab-clubhouse.js";
import { labBoardView } from "@/lib/lab-board-view.js";
import { labSurvivorChampion, LAB_SURVIVOR_LAST_WEEK } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";
import { useStableCallback } from "@/lib/use-stable-callback";

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

/** A pick that is in but not shown yet: one lit lamp, the same as the ticket's lamp for a pick sent in (a spade for Survivor). It reads as
 * made, never as empty, and never says which team. */
export function HiddenPick({ survivor = false, label = "Pick in, hidden until kickoff" }: { survivor?: boolean; label?: string }) {
  return (
    <span className="lab-tote-cover">
      <Lamp label={label} state="in" survivor={survivor} />
    </span>
  );
}

/** No pick (yet): the same lamp in the same place, just not lit, so every row reads the same and a missing pick is plain to see. */
export function NoPick({ survivor = false, label }: { survivor?: boolean; label: string }) {
  return (
    <span className="lab-tote-cover">
      <Lamp label={label} state="off" survivor={survivor} />
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
              <th className="lab-tote-name" scope="row"><span className="lab-tote-player">{row.name.toUpperCase()}</span>{standing ? <small>{standing}</small> : null}</th>
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
              <th className="lab-tote-name" scope="row">{row.name.toUpperCase()}</th>
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
function WeekChoice({ view, onWeek, text, step = false }: { view: BoardView; onWeek: (weekId: string) => void; text: string; step?: boolean }) {
  const at = view.weeks.findIndex((week) => week.id === view.weekId);
  const before = at > 0 ? view.weeks[at - 1] : null;
  const after = at >= 0 && at < view.weeks.length - 1 ? view.weeks[at + 1] : null;
  const label = (
    <label className="lab-tote-week">
      <span>{text} <i aria-hidden="true">▾</i></span>
      <select aria-label="Change week" onChange={(event) => onWeek(event.target.value)} value={view.weekId ?? ""}>
        {view.weeks.map((week) => <option key={week.id} value={week.id}>{week.name}{week.status === "complete" ? " — Final" : ""}</option>)}
      </select>
    </label>
  );
  if (!step) return label;
  return (
    <div className="lab-week-step">
      <button aria-label={before ? `Back to ${before.name}` : "No earlier week"} disabled={!before} onClick={() => before && onWeek(before.id)} type="button"><i aria-hidden="true" /></button>
      {label}
      <button aria-label={after ? `On to ${after.name}` : "No later week"} disabled={!after} onClick={() => after && onWeek(after.id)} type="button"><i aria-hidden="true" /></button>
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
          <button onClick={onSurvivor} type="button">Survivor</button>
        </div>
      ) : null}
      {view.playoff ? <p className="lab-tote-race">{raceLine(view)}</p> : null}
      <WeekFace open={view.canPick ? onOpen : null} view={view} />
      {view.canPick ? (
        <button className={`lab-tote-ticket${owed ? " is-owed" : ""}`} onClick={onOpen} type="button">
          <span className="lab-tote-ticket-body">
            <b>{owed ? `${owed} ${owed === 1 ? "PICK" : "PICKS"} TO MAKE` : savedAt ? "PICKS SAVED ✓" : sent ? "SUBMITTED ✓" : "ALL PICKS IN"}</b>
            <span>{owed ? "Tap here to pick" : savedAt ? `Saved at ${savedAt}` : "Tap here to change a pick"}</span>
          </span>
          <span aria-hidden="true" className="lab-tote-ticket-stub">{owed ? "PICK" : "VIEW"}<i /></span>
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
/** What a decided side says about itself: its final score, whether it covered its line (a push counts as a miss, and the gold says it), and who took it. */
function coverNote(result: BoardView["games"][number]["results"][string]) {
  const covered = result.ats === "W";
  const size = result.margin === null ? "" : ` ${Math.abs(result.margin)}`;
  return { score: result.score, covered, says: covered ? `COVERED BY${size}`.trim() : result.margin === 0 ? "PUSH · A MISS" : `MISSED BY${size}`.trim(), pickers: result.pickers };
}

/**
 * `onDirty` hears, every time it changes, whether the ticket holds picks not sent yet: a way to send them (it answers whether they were
 * saved), or null once nothing is waiting. The clubhouse uses it to ask before the ticket is put away with picks still on it.
 */
export function TicketForm({ view, onSubmit, poolAction, onPoolAction, onWeek, startOn = "pickem", footer = null, onDirty }: { view: BoardView; onSubmit: (ticket: Ticket) => void | string | Promise<void | string>; poolAction?: boolean; onPoolAction?: (on: boolean) => void; onWeek?: (weekId: string) => void; startOn?: "pickem" | "survivor"; footer?: ReactNode; onDirty?: (send: (() => Promise<boolean>) | null) => void }) {
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
  // The ticket opens on Pick'em, or on Survivor when the Survivor table's Pick button brought the player here.
  const [mode, setMode] = useState<"pickem" | "survivor">(startOn === "survivor" && pickingSurvivor ? "survivor" : "pickem");
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
  // A playoff round names each line by its game (a pick for every game); a regular week by Pick 1 and Pick 2.
  const lines = view.playoff
    ? view.games.map((game) => { const team = picks.find((pick) => pick === game.away || pick === game.home); return { label: `${game.away} @ ${game.home}`, value: team ? `${team} ${lineOf(view, team)}` : null }; })
    : [...Array.from({ length: cap }, (_, index) => ({ label: `Pick ${index + 1}`, value: ordered[index] ? `${ordered[index]} ${lineOf(view, ordered[index])}` : null })), ...(pickingSurvivor ? [{ label: "Survivor", value: chip ? name(chip) : null }] : [])];
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

  async function send(): Promise<boolean> {
    setSending(true);
    setProblem("");
    try {
      const answer = await onSubmit({ picks: ordered, survivor: pickingSurvivor ? chip : null });
      if (typeof answer === "string") { setProblem(answer); return false; }
      return true;
    } finally { setSending(false); }
  }
  // The latest send, for the page that asks before the ticket is put away with picks still on it.
  const sendNow = useStableCallback(send);
  useEffect(() => { onDirty?.(changed ? sendNow : null); }, [changed, onDirty, sendNow]);
  useEffect(() => () => onDirty?.(null), [onDirty]);
  // Whether any line on the ticket can still move: the key under the games says what the gold means only when it matters.
  const anyMoving = shownGames.some((game) => !game.kickedOff && !game.lineFinal);
  const anyLocked = shownGames.some((game) => game.lineFinal);

  return (
    <div className="lab-bigboard is-tote trace-gilt lab-window">
      <header>
        {onWeek && view.weeks.length > 1 ? <WeekChoice onWeek={onWeek} step text={view.week} view={view} /> : <h3>{view.week}</h3>}
        <ul aria-label="Your picks" className="lab-lamps">
          {lamps.map((lamp) => <li key={lamp.label}><Lamp label={`${lamp.label}: ${LAMP_SAYS[lamp.state]}`} state={lamp.state} survivor={lamp.survivor} /><small aria-hidden="true">{lamp.survivor ? "SURV" : lamp.label.replace("Pick ", "P")}</small></li>)}
        </ul>
      </header>
      {view.playoff?.you.forfeited || view.playoff?.you.out ? <p className="lab-ticket-raceover">{view.playoff.you.forfeited ? "You forfeited · your score stands" : "Out of the race · your score stands"}</p> : null}

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
        {mode === "pickem" && anyMoving ? <p className="lab-line-key">{anyLocked ? <><b className="is-gold">Gold line:</b> locked, it won’t change. <b>White line:</b> can still move until 8 AM on game day.</> : <>Lines can still move until 8 AM on game day. Once a line locks it turns gold.</>}</p> : null}
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
                <button aria-label={`${name(team)} ${line}${final ? `, final ${final.score}, ${final.says.toLowerCase()}, picked by ${final.pickers.length ? final.pickers.join(", ") : "no one"}` : ""}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} onClick={() => choose(team, game.id)} type="button">
                  <span className="lab-board-team"><Logo team={team} />{team}</span>
                  <span className={`lab-board-line ${game.lineFinal ? "is-final" : ""}`}>{line}</span>
                  {final ? <span className={`lab-board-final ${final.covered ? "is-covered" : ""}`}><b>{final.score}</b><em>{final.pickers.length ? final.pickers.map((picker, index) => <Fragment key={picker}>{index ? " · " : ""}<u>{picker.toUpperCase()}</u></Fragment>) : "NO PICKS"}</em></span> : null}
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
        <p className="lab-board-note">{view.playoff ? "Pick every game against the spread. Send the whole round at once, and change any pick until its game kicks off." : view.champion ? `Survivor is decided: ${view.champion} won it.` : "Tap a team to pick it; tap again to take it back. Change any pick until its game kicks off."}</p>
      </section>
      {/* Below the games and the send button, inside the ticket: Forfeit in the playoffs. */}
      {footer}
    </div>
  );
}

/* ---------------------------------------------------------------- The room ---------------------------------------------------------------- */

type Scene = "before" | "gameday" | "graded" | "out" | "over" | "wildcard" | "wildcard-day" | "wildcard-out";
const SCENES: ReadonlyArray<readonly [Scene, string]> = [["before", "Before kickoff"], ["gameday", "Game day"], ["graded", "Graded"], ["out", "Out of Survivor"], ["over", "Survivor decided"], ["wildcard", "Wild Card"], ["wildcard-day", "Wild Card game day"], ["wildcard-out", "Out of the race"]];

/**
 * What a player has in at the start of a sample scene: both picks, and the Survivor team unless one is still owed. In the Wild Card
 * round, four of the six picks, so two are owed.
 */
function sampleTicket(viewer: string, survivorIn: boolean, round: "regular" | "wildcard" = "regular"): Ticket {
  const picks = labStandard(viewer, { round, moment: "before", viewer }).slats.map((slat) => slat.team as string);
  if (round === "wildcard") return { picks: picks.slice(0, 4), survivor: null };
  return { picks, survivor: survivorIn ? (LAB_WEEK10_SURVIVOR as Record<string, string>)[viewer] ?? null : null };
}
const viewerOf = (scene: Scene) => (scene === "out" ? "Hank" : scene === "wildcard-out" ? "Bev" : LAB_VIEWER);
const roundOf = (scene: Scene) => (scene.startsWith("wildcard") ? "wildcard" : "regular");

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
  // "Out of Survivor" is seen as Hank, who lost in week 3; "Out of the race" as Bev, who can no longer catch the leader; the rest as Walt.
  const viewer = viewerOf(scene);
  const round = roundOf(scene);
  const moment = scene === "gameday" || scene === "graded" ? scene : scene === "wildcard-day" ? "gameday" : "before";
  const champion = scene === "over" ? labSurvivorChampion(LAB_SURVIVOR_LAST_WEEK) : null;
  const view = labBoardView({ moment, viewer, ticket, champion, round });
  const canPick = view.canPick;

  function setScene(next: Scene) {
    setSceneOnly(next);
    setTicket(sampleTicket(viewerOf(next), next === "before" ? survivorIn : true, roundOf(next)));
    setSent(false);
  }
  function submit(next: Ticket) {
    setTicket(next);
    setOpen(false);
    setSent(true);
    onTicket?.(next.picks.length === view.maxPicks && (!view.survivor.playing || Boolean(next.survivor)));
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
