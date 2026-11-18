"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { BowlRowState, BowlSide, BowlTicketGame } from "@/lib/bowl-ticket-view.js";
import { haptic } from "@/lib/haptics-client";

export type BowlTicketData = {
  optedIn: boolean;
  entryOpen: boolean;
  games: BowlTicketGame[];
  saved: Record<string, BowlSide>;
  guess: string;
  tiebreakerLocked: boolean;
  total: number;
  decided: number;
  owed: number;
  standings: Array<{ id: string; name: string; wins: number; losses: number; you: boolean; place: number; tied: boolean }>;
};

/**
 * The Bowl ticket: the Bowl Pool as one ticket, the Window's layout in the Bowl Pool's navy and old gold. The clubhouse draws it from the
 * Bowl Pool's own read (see bowl-ticket-view.js); the Workshop Lab draws it from sample bowls.
 *  - Picks and Standings on one page, swapped with the two tabs at the top.
 *  - The header's gauge shows how much of bowl season is decided, marked at a quarter, half and three quarters, with the bowls left under it.
 *  - Every bowl flies its own pennant: its real logo, in full colour, on a pennant in the logo's own colours (a bowl without a logo file
 *    flies a navy pennant lettered with its short name). A bowl you still owe a pick waves its pennant, its row carries a gold edge and
 *    PICK DUE with the lock time, and the header counts them ("3 TO PICK"); once picked the pennant hangs still. A bowl that kicked off
 *    without your pick fades its pennant to grey and says MISSED (a loss). This is not the Pick'em ticket's lamps.
 * Save sends every open pick and the tiebreaker at once; a game that has kicked off is never sent.
 */
export function BowlTicketCard({ view, onSave, onOptOut, flagStyle = "logo" }: {
  view: BowlTicketData;
  onSave: (picks: Record<string, BowlSide>, guess: string) => Promise<string | void> | string | void;
  onOptOut?: () => void;
  flagStyle?: "name" | "logo";
}) {
  const [tab, setTab] = useState<"picks" | "standings">("picks");
  const [picks, setPicks] = useState<Record<string, BowlSide>>(view.saved);
  const [guess, setGuess] = useState(view.guess);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const open = (game: BowlTicketGame) => !game.locked;
  const changed = view.games.some((game) => open(game) && picks[game.id] !== view.saved[game.id]) || guess !== view.guess;
  const days = useMemo(() => [...new Set(view.games.map((game) => game.day))], [view.games]);
  const pickedCount = view.games.filter((game) => picks[game.id]).length;

  const choose = (game: BowlTicketGame, side: BowlSide) => {
    setProblem("");
    const next = { ...picks };
    if (next[game.id] === side) { delete next[game.id]; haptic("lightTick"); } else { next[game.id] = side; haptic("tick"); }
    setPicks(next);
  };

  async function save() {
    setSending(true);
    setProblem("");
    try {
      const answer = await onSave(picks, guess);
      if (typeof answer === "string") setProblem(answer);
    } finally { setSending(false); }
  }

  const caption = (game: BowlTicketGame) => {
    if (game.note) return game.note.toUpperCase();
    if (game.state === "missed") return "MISSED · COUNTS AS A LOSS";
    if (game.state === "owed") return `PICK DUE · LOCKS ${game.time}`;
    if (game.final) return "FINAL";
    if (game.locked) return "KICKED OFF";
    return game.time;
  };

  return (
    <div className="lab-bigboard lab-window lab-bowl-ticket trace-gilt">
      <header className="lab-bowl-head">
        <div className="lab-bowl-title">
          <p aria-hidden="true">★ ★ ★</p>
          <h3>Bowl Pool</h3>
          {view.owed ? <span className="lab-bowl-due"><BowlFlag flag="" small state="owed" /> {view.owed} TO PICK</span> : <span className="lab-bowl-due is-clear">{view.decided === view.total && view.total ? "ALL DECIDED" : "ALL PICKED"}</span>}
        </div>
        <BowlGauge played={view.decided} total={view.total} />
      </header>

      <div aria-label="Bowl Pool view" className="lab-chips lab-ticket-switch lab-ticket-action" role="group">
        <button aria-pressed={tab === "picks"} onClick={() => setTab("picks")} type="button">Picks</button>
        <button aria-pressed={tab === "standings"} onClick={() => setTab("standings")} type="button">Standings</button>
      </div>

      {tab === "picks" ? <>
        <section aria-label="Bowl picks" className="lab-window-part">
          {view.games.length === 0 ? <p className="lab-board-note">The bowl schedule is not set yet.</p> : null}
          {days.map((day) => (
            <div className="lab-bowl-day" key={day}>
              <h4>{day}</h4>
              <ol>
                {view.games.filter((game) => game.day === day).map((game) => {
                  const cell = (index: number) => {
                    const team = game.cells[index];
                    const picked = picks[game.id] === team.side;
                    return (
                      <button aria-label={`${team.name} ${team.line}${team.score !== null ? `, final ${team.score}${team.covered ? ", covered" : ""}` : ""}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${game.locked ? "is-locked" : ""}`} disabled={game.locked} onClick={() => choose(game, team.side)} style={team.colors ? { "--team-primary": team.colors.primary, "--team-secondary": team.colors.secondary } as CSSProperties : undefined} type="button">
                        <span className="lab-board-team">{team.name}</span>
                        <span className="lab-board-line">{team.line}</span>
                        {team.score !== null ? <span className={`lab-board-final ${team.covered ? "is-covered" : ""}`}><b>{team.score}</b><em>{team.covered ? "COVERED" : ""}</em></span> : null}
                        <span aria-hidden="true" className="lab-board-trace" />
                      </button>
                    );
                  };
                  return (
                    <li className={`lab-bowl-game is-${game.state}`} key={game.id}>
                      <span className="lab-bowl-name">
                        {flagStyle === "logo" && game.logo ? <BowlLogoFlag cloth={game.cloth} hoist={game.hoist} logo={game.logo} state={game.state} /> : <BowlFlag flag={game.flag} state={game.state} />}
                        <span><b>{game.bowl}</b><small>{caption(game)}</small></span>
                      </span>
                      {cell(0)}
                      <span aria-hidden="true" className="lab-board-at">vs</span>
                      {cell(1)}
                      {game.tiebreaker ? (
                        <label className="lab-bowl-tiebreaker">
                          <span>Tiebreaker: total points in this game</span>
                          <input disabled={game.locked} inputMode="numeric" maxLength={3} onChange={(event) => { setProblem(""); setGuess(event.target.value.replace(/\D/g, "")); }} placeholder="—" value={guess} />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>

        <section aria-label="Your bowl ticket" className="lab-window-ticket">
          <dl>
            <div><dt>Picked</dt><dd>{pickedCount} of {view.total}</dd></div>
            <div><dt>Still to pick</dt><dd>{view.owed || "None"}</dd></div>
            <div><dt>Tiebreaker</dt><dd>{view.guess ? `${view.guess} points` : "—"}</dd></div>
          </dl>
          <button className="lab-window-submit" disabled={!changed || sending} onClick={() => void save()} type="button">{sending ? "Saving…" : changed ? "Save picks" : "Saved"}</button>
          {problem ? <p className="lab-window-problem" role="alert">{problem}</p> : null}
          {onOptOut && view.entryOpen ? <button className="lab-bowl-optout" onClick={onOptOut} type="button">Opt out of the Bowl Pool</button> : null}
        </section>
      </> : (
        <section aria-label="Bowl standings" className="lab-window-part">
          <h4>STANDINGS<small>{view.decided ? `after ${view.decided} of ${view.total} bowls` : "no bowls played yet"}</small></h4>
          {view.standings.length === 0 ? <p className="lab-board-note">No one has claimed a seat yet.</p> : null}
          <ol className="lab-bowl-standings">
            {view.standings.map((row) => (
              <li className={row.you ? "is-you" : ""} key={row.id}>
                <span>{row.tied ? `T${row.place}` : row.place}</span>
                <b>{row.name}</b>
                <em>{row.wins}–{row.losses}</em>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * The bowl's name pennant: a felt pennant with a gold hoist, lettered with the bowl's short name. Gold while a pick is owed, navy once
 * picked, grey when the bowl kicked off without one.
 */
export function BowlFlag({ flag, state, small = false }: { flag: string; state: BowlRowState; small?: boolean }) {
  const size = flag.length > 7 ? 11 : flag.length > 4 ? 13 : 16;
  return (
    <span aria-hidden="true" className={`lab-bowl-flag is-${state} ${small ? "is-small" : ""}`}>
      <svg focusable="false" viewBox="0 0 120 40">
        <path className="lab-bowl-flag-cloth" d="M8 1L118 20L8 39Z" />
        <rect className="lab-bowl-flag-hoist" height="40" rx="2" width="9" x="0" y="0" />
        <text className="lab-bowl-flag-name" fontSize={small ? 22 : size} x={small ? 40 : 14} y="21" {...(flag.length > 7 ? { lengthAdjust: "spacingAndGlyphs", textLength: 66 } : {})}>{flag}</text>
      </svg>
    </span>
  );
}

/**
 * The bowl's logo pennant: the real logo in full colour, sewn on near the hoist like a patch, on a pennant in the logo's own colours (its
 * cloth and hoist). It waves while a pick is owed and fades to grey when the bowl kicked off without one.
 */
export function BowlLogoFlag({ logo, cloth, hoist, state }: { logo: string; cloth: string | null; hoist: string | null; state: BowlRowState }) {
  return (
    <span aria-hidden="true" className={`lab-bowl-flag is-logo is-${state}`} style={{ "--flag-cloth": cloth ?? undefined, "--flag-hoist": hoist ?? undefined } as CSSProperties}>
      <svg focusable="false" viewBox="0 0 140 56">
        <path className="lab-bowl-flag-cloth" d="M10 1L138 28L10 55Z" />
        <rect className="lab-bowl-flag-hoist" height="56" rx="2" width="11" x="0" y="0" />
        <image height="48" href={`/bowl-logos/${logo}.webp`} preserveAspectRatio="xMidYMid meet" width="56" x="14" y="4" />
      </svg>
    </span>
  );
}

/** How much of bowl season is decided: a half-dial marked at a quarter, half and three quarters, the needle at the share decided, and the bowls left. */
export function BowlGauge({ played, total }: { played: number; total: number }) {
  const share = total ? Math.min(1, played / total) : 0;
  const point = (fraction: number, radius: number) => {
    const angle = Math.PI * (1 - fraction);
    return { x: 50 + radius * Math.cos(angle), y: 50 - radius * Math.sin(angle) };
  };
  const end = point(share, 40);
  const needle = point(share, 33);
  const left = Math.max(0, total - played);
  return (
    <figure aria-label={left ? `${left} of ${total} bowls left` : `All ${total} bowls played`} className="lab-bowl-gauge" role="img">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 100 58">
        <path className="lab-bowl-gauge-track" d="M10 50A40 40 0 0 1 90 50" />
        {share > 0 ? <path className="lab-bowl-gauge-fill" d={`M10 50A40 40 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} /> : null}
        {[0.25, 0.5, 0.75].map((mark) => {
          const outer = point(mark, 45), inner = point(mark, 35), label = point(mark, 26);
          return (
            <g key={mark}>
              <line className="lab-bowl-gauge-tick" x1={outer.x} x2={inner.x} y1={outer.y} y2={inner.y} />
              <text className="lab-bowl-gauge-mark" x={label.x} y={label.y + 3}>{mark === 0.25 ? "¼" : mark === 0.5 ? "½" : "¾"}</text>
            </g>
          );
        })}
        <line className="lab-bowl-gauge-needle" x1="50" x2={needle.x} y1="50" y2={needle.y} />
        <circle className="lab-bowl-gauge-hub" cx="50" cy="50" r="3.5" />
      </svg>
      <figcaption>{left ? <><b>{left}</b> LEFT</> : "ALL PLAYED"}</figcaption>
    </figure>
  );
}
