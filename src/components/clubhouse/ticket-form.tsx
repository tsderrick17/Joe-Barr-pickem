"use client";

import { haptic } from "@/lib/haptics-client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { BoardView } from "@/lib/board-view.js";
import { useStableCallback } from "@/lib/use-stable-callback";
import { gameOf, inOrder, lineOf, WeekChoice, type Ticket } from "@/components/clubhouse/big-board";
import { Lamp, LAMP_SAYS, lampFor, Logo, type LampState } from "@/components/clubhouse/lamps";

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
    // The same feels as the Slate: a pick ticks, taking one back is lighter, a full ticket warns.
    if (picks.includes(team)) { haptic("lightTick"); setPicks(picks.filter((pick) => pick !== team)); return; }
    if (picks.length >= cap && !picks.includes(other)) { haptic("warning"); return; }
    const next = [...picks.filter((pick) => pick !== other), team];
    haptic("tick");
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
        <button aria-pressed={!actionOnly} onClick={() => { haptic("tick"); chooseAction(false); }} type="button">All games</button>
        <button aria-pressed={actionOnly} onClick={() => { haptic("tick"); chooseAction(true); }} type="button">Pool action</button>
      </div>

      {pickingSurvivor ? (
        <div aria-label="What to pick" className="lab-chips lab-ticket-switch" role="group">
          <button aria-pressed={mode === "pickem"} onClick={() => { haptic("tick"); setMode("pickem"); }} type="button">Pick’em<small>pick {cap} vs. the spread</small></button>
          <button aria-pressed={mode === "survivor"} onClick={() => { haptic("tick"); setMode("survivor"); }} type="button">Survivor<small>pick 1 · {survivor.left} teams left</small></button>
        </div>
      ) : null}
      {survivor.out && !view.champion ? <p className="lab-window-out">You’re out of Survivor{survivor.outWeek ? ` (lost in week ${survivor.outWeek})` : ""}. The pool goes on: follow it at the Survivor table.</p> : null}

      {/* The games, the ticket and its send button scroll as one, under the heading that stands still. */}
      <div className="lab-window-scroll">
      <section aria-label={mode === "survivor" ? "Survivor" : "Pick’em"} className="lab-window-part">
        {shownGames.length === 0 ? <p className="lab-board-note">No pool action in this week’s games yet. Switch to All games to see them.</p> : null}
        {mode === "pickem" && anyMoving ? <p className="lab-line-key">{anyLocked ? <><b className="is-gold">Gold line:</b> locked. <b>White line:</b> can move until 8 AM on game day.</> : <>Lines can move until 8 AM on game day, then lock in gold.</>}</p> : null}
        <ol>
          {shownGames.map((game) => {
            const locked = game.kickedOff;
            const cell = (team: string) => {
              if (mode === "survivor") {
                const entry = survivor.teams[team];
                const picked = chip === team;
                return (
                  <button aria-label={name(team)} aria-pressed={picked} className={`lab-board-cell is-survivor ${picked ? "is-picked" : ""} ${entry.free ? "" : "is-locked"}`} disabled={!entry.free} onClick={() => { haptic(picked ? "lightTick" : "lockIn"); setChip(picked ? null : team); }} type="button">
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
              // From kickoff, while the game is being played, each side names who took it (picks are public once a game kicks off).
              const live = !final && locked && result.pickers.length > 0 ? result.pickers : null;
              return (
                <button aria-label={`${name(team)} ${line}${final ? `, final ${final.score}, ${final.says.toLowerCase()}, picked by ${final.pickers.length ? final.pickers.join(", ") : "no one"}` : live ? `, picked by ${live.join(", ")}` : ""}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} onClick={() => choose(team, game.id)} type="button">
                  <span className="lab-board-team"><Logo team={team} />{team}</span>
                  <span className={`lab-board-line ${game.lineFinal ? "is-final" : ""}`}>{line}</span>
                  {final ? <span className={`lab-board-final ${final.covered ? "is-covered" : ""}`}><b>{final.score}</b><em>{final.pickers.length ? final.pickers.map((picker, index) => <Fragment key={picker}>{index ? " · " : ""}<u>{picker.toUpperCase()}</u></Fragment>) : "NO PICKS"}</em></span> : null}
                  {live ? <span className="lab-board-final is-live"><em>{live.map((picker, index) => <Fragment key={picker}>{index ? " · " : ""}<u>{picker.toUpperCase()}</u></Fragment>)}</em></span> : null}
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
    </div>
  );
}
