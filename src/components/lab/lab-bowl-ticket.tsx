"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { LAB_BOWL_MINE, LAB_BOWL_STOPS, LAB_BOWL_VIEWER, LAB_BOWLS, labBowlLine, labBowlResult, labBowlStandings } from "@/lib/lab-bowl-samples.js";

type Side = "away" | "home";
type Game = (typeof LAB_BOWLS)[number];
type FlagState = "owed" | "picked" | "missed" | "done";
const MINE = LAB_BOWL_MINE as Record<string, Side>;

/**
 * Lab try-out: the Bowl Pool as one ticket, the Window's layout in the Bowl Pool's own navy and old gold.
 *  - Picks and Standings on one page, swapped with the two tabs at the top.
 *  - The header's gauge shows how much of bowl season is played, marked at a quarter, half and three quarters, with the games left under it.
 *  - Every bowl flies its own pennant. A bowl you still owe a pick flies it in gold and the header counts them ("3 TO PICK"); picking it
 *    lowers it to navy. A bowl that kicked off without your pick shows its pennant grey and MISSED (a loss). This is not the lamps.
 *  - The pennant is lettered with the bowl's short name. The Logo choice shows the bowl's logo in one colour instead, where a logo file exists.
 * Sample players and bowls only; nothing is saved.
 */
export function LabBowlTicket() {
  const [stopId, setStopId] = useState(LAB_BOWL_STOPS[1].id);
  const [flagStyle, setFlagStyle] = useState<"name" | "logo">("name");
  const stop = LAB_BOWL_STOPS.find((item) => item.id === stopId) ?? LAB_BOWL_STOPS[0];
  return (
    <section aria-label="Bowl ticket try-out" className="lab-tote-room">
      <div aria-label="Day of bowl season" className="lab-chips" role="group">
        {LAB_BOWL_STOPS.map((item) => <button aria-pressed={item.id === stop.id} key={item.id} onClick={() => setStopId(item.id)} type="button">{item.label}</button>)}
      </div>
      <div aria-label="Pennant style" className="lab-chips" role="group">
        <button aria-pressed={flagStyle === "name"} onClick={() => setFlagStyle("name")} type="button">Name pennants</button>
        <button aria-pressed={flagStyle === "logo"} onClick={() => setFlagStyle("logo")} type="button">Logo pennants</button>
      </div>
      {flagStyle === "logo" ? <p className="workshop-lab-intro">One-colour logos need the bowls&apos; logo files, which are not in the app yet, so these still show the names.</p> : null}
      <BowlTicket flagStyle={flagStyle} key={stop.id} played={stop.played} />
    </section>
  );
}

/** Bowl logo files by bowl id, drawn in one colour on the pennant. Empty until the files are added; a bowl without one shows its name. */
const BOWL_LOGOS: Record<string, string> = {};

function BowlTicket({ played, flagStyle }: { played: number; flagStyle: "name" | "logo" }) {
  const [tab, setTab] = useState<"picks" | "standings">("picks");
  const [saved, setSaved] = useState<Record<string, Side>>(MINE);
  const [picks, setPicks] = useState<Record<string, Side>>(MINE);
  const [savedTotal, setSavedTotal] = useState("");
  const [total, setTotal] = useState("");
  const kickedOff = (index: number) => index < played;
  const owed = LAB_BOWLS.filter((game, index) => !kickedOff(index) && !saved[game.id]).length;
  const changed = LAB_BOWLS.some((game) => picks[game.id] !== saved[game.id]) || total !== savedTotal;
  const days = useMemo(() => [...new Set(LAB_BOWLS.map((game) => game.day))], []);
  const standings = useMemo(() => labBowlStandings(played, saved), [played, saved]);
  const pickedCount = Object.keys(picks).length;

  const choose = (game: Game, side: Side) => {
    const next = { ...picks };
    if (next[game.id] === side) delete next[game.id]; else next[game.id] = side;
    setPicks(next);
  };

  const stateOf = (game: Game, index: number): FlagState => {
    if (kickedOff(index)) return saved[game.id] ? "done" : "missed";
    return saved[game.id] ? "picked" : "owed";
  };

  return (
    <div className="lab-bigboard lab-window lab-bowl-ticket trace-gilt">
      <header className="lab-bowl-head">
        <div className="lab-bowl-title">
          <p aria-hidden="true">★ ★ ★</p>
          <h3>Bowl Pool</h3>
          {owed ? <span className="lab-bowl-due"><BowlFlag flag="" small state="owed" /> {owed} TO PICK</span> : <span className="lab-bowl-due is-clear">ALL PICKED</span>}
        </div>
        <BowlGauge played={played} total={LAB_BOWLS.length} />
      </header>

      <div aria-label="Bowl Pool view" className="lab-chips lab-ticket-switch lab-ticket-action" role="group">
        <button aria-pressed={tab === "picks"} onClick={() => setTab("picks")} type="button">Picks</button>
        <button aria-pressed={tab === "standings"} onClick={() => setTab("standings")} type="button">Standings</button>
      </div>

      {tab === "picks" ? <>
        <section aria-label="Bowl picks" className="lab-window-part">
          {days.map((day) => (
            <div className="lab-bowl-day" key={day}>
              <h4>{day.toUpperCase()}</h4>
              <ol>
                {LAB_BOWLS.map((game, index) => {
                  if (game.day !== day) return null;
                  const state = stateOf(game, index);
                  const locked = kickedOff(index);
                  const cell = (side: Side) => {
                    const picked = picks[game.id] === side;
                    const result = locked ? labBowlResult(game, side) : null;
                    const school = side === "away" ? game.away : game.home;
                    return (
                      <button aria-label={`${school} ${labBowlLine(game, side)}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} onClick={() => choose(game, side)} type="button">
                        <span className="lab-board-team">{school}</span>
                        <span className="lab-board-line">{labBowlLine(game, side)}</span>
                        {locked ? <span className={`lab-board-final ${result === "W" ? "is-covered" : ""}`}><b>{side === "away" ? game.final[0] : game.final[1]}</b><em>{result === "W" ? "COVERED" : ""}</em></span> : null}
                        <span aria-hidden="true" className="lab-board-trace" />
                      </button>
                    );
                  };
                  return (
                    <li className={`lab-bowl-game is-${state}`} key={game.id}>
                      <span className="lab-bowl-name">
                        <BowlFlag flag={game.flag} logo={flagStyle === "logo" ? BOWL_LOGOS[game.id] : undefined} state={state} />
                        <span><b>{game.bowl}</b><small>{state === "missed" ? "MISSED · COUNTS AS A LOSS" : state === "owed" ? `PICK DUE · LOCKS ${game.time}` : locked ? "FINAL" : game.time}</small></span>
                      </span>
                      {cell("away")}
                      <span aria-hidden="true" className="lab-board-at">vs</span>
                      {cell("home")}
                      {game.tiebreaker ? (
                        <label className="lab-bowl-tiebreaker">
                          <span>Tiebreaker: total points in this game</span>
                          <input disabled={locked} inputMode="numeric" maxLength={3} onChange={(event) => setTotal(event.target.value.replace(/\D/g, ""))} placeholder="—" value={total} />
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
            <div><dt>Picked</dt><dd>{pickedCount} of {LAB_BOWLS.length}</dd></div>
            <div><dt>Still to pick</dt><dd>{owed || "None"}</dd></div>
            <div><dt>Tiebreaker</dt><dd>{savedTotal ? `${savedTotal} points` : "—"}</dd></div>
          </dl>
          <button className="lab-window-submit" disabled={!changed} onClick={() => { setSaved(picks); setSavedTotal(total); }} type="button">{changed ? "Save picks" : "Saved"}</button>
        </section>
      </> : (
        <section aria-label="Bowl standings" className="lab-window-part">
          <h4>STANDINGS<small>{played ? `after ${played} of ${LAB_BOWLS.length} bowls` : "no bowls played yet"}</small></h4>
          <ol className="lab-bowl-standings">
            {standings.map((row) => {
              const place = standings.findIndex((other) => other.wins === row.wins) + 1;
              const tied = standings.filter((other) => other.wins === row.wins).length > 1;
              return (
                <li className={row.name === LAB_BOWL_VIEWER ? "is-you" : ""} key={row.name}>
                  <span>{tied ? `T${place}` : place}</span>
                  <b>{row.name}</b>
                  <em>{row.wins}–{row.losses}</em>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * The bowl's pennant: a felt pennant with a gold hoist, lettered with the bowl's short name (or its logo in one colour). Gold while a pick
 * is owed, navy once picked, grey when the bowl kicked off without one.
 */
function BowlFlag({ flag, state, logo, small = false }: { flag: string; state: FlagState; logo?: string; small?: boolean }) {
  const size = flag.length > 7 ? 11 : flag.length > 4 ? 13 : 16;
  return (
    <span aria-hidden="true" className={`lab-bowl-flag is-${state} ${small ? "is-small" : ""}`}>
      <svg focusable="false" viewBox="0 0 120 40">
        <path className="lab-bowl-flag-cloth" d="M8 1L118 20L8 39Z" />
        <rect className="lab-bowl-flag-hoist" height="40" rx="2" width="9" x="0" y="0" />
        {logo ? null : <text className="lab-bowl-flag-name" fontSize={small ? 22 : size} x={small ? 40 : 14} y="21" {...(flag.length > 7 ? { lengthAdjust: "spacingAndGlyphs", textLength: 66 } : {})}>{flag}</text>}
      </svg>
      {logo ? <span className="lab-bowl-flag-logo" style={{ "--bowl-logo": `url(${logo})` } as CSSProperties} /> : null}
    </span>
  );
}

/** How much of bowl season is played: a half-dial marked at a quarter, half and three quarters, the needle at the share played, and the games left. */
function BowlGauge({ played, total }: { played: number; total: number }) {
  const share = total ? played / total : 0;
  const point = (fraction: number, radius: number) => {
    const angle = Math.PI * (1 - fraction);
    return { x: 50 + radius * Math.cos(angle), y: 50 - radius * Math.sin(angle) };
  };
  const end = point(share, 40);
  const needle = point(share, 33);
  const left = total - played;
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
