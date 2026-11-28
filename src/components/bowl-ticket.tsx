"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import BowlScoreTile from "@/components/bowl-score-tile";
import { SaveBar } from "@/components/clubhouse/save-bar";
import { Lamp } from "@/components/clubhouse/lamps";
import PlayerTrophyName from "@/components/player-trophy-name";
import type { BowlRowState, BowlSide, BowlTicketGame } from "@/lib/bowl-ticket-view.js";
import { haptic } from "@/lib/haptics-client";
import { useStableCallback } from "@/lib/use-stable-callback";

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
  picked?: number;
  standings: Array<{ id: string; name: string; trophies?: string[]; holdsTrophy?: boolean; wins: number; losses: number; you: boolean; place: number; tied: boolean }>;
  /** Everyone's picks on every bowl (the classic Bowl Card), when the Bowl Pool's read is the real one. */
  sheet?: BowlSheetData;
};

export type BowlSheetCell = { kind: "pick"; team: string; result: "W" | "L" | null } | { kind: "hidden" } | { kind: "none"; result: "W" | "L" | null; missed?: boolean };
export type BowlSheetData = {
  games: Array<{ id: string; name: string; day: string; locked: boolean; matchup: Array<{ team: string; line: string }> }>;
  todayIndex: number;
  rows: Array<{ id: string; name: string; trophies?: string[]; holdsTrophy?: boolean; wins: number; losses: number; place: number; tied: boolean; tiebreaker?: number | null; you: boolean; cells: BowlSheetCell[] }>;
};

/**
 * The Bowl ticket: the Bowl Pool as one ticket, the Window's layout in the Bowl Pool's navy and old gold. The clubhouse draws it from the
 * Bowl Pool's own read (see bowl-ticket-view.js); the Workshop Lab draws it from sample bowls.
 *  - Picks and Standings on one page, swapped with the two tabs at the top.
 *  - The header's gauge shows how much of bowl season is decided, marked at a quarter, half and three quarters, with the bowls left under it.
 *  - Every bowl flies its own pennant: its real logo, in full colour, on a pennant in the logo's own colours (a bowl without a logo file
 *    flies a navy pennant lettered with its short name). A bowl you still owe a pick waves its pennant, its row carries a gold edge and
 *    its game time like any other, and the header counts them ("3 TO PICK"); once picked the pennant hangs still. A bowl that kicked off
 *    without your pick fades its pennant to grey and says MISSED (a loss). This is not the Pick'em ticket's lamps.
 * Save sends every open pick and the tiebreaker at once; a game that has kicked off is never sent. The tiebreaker (total points in the
 * title game) is entered in the ticket's own box beside Save, where it is always in sight, and Save reminds a player who left it blank.
 * `onDirty` hears whether there are picks or a tiebreaker not saved yet, with a way to save them (see TicketForm's).
 */
export function BowlTicketCard({ view, onSave, onOptOut, flagStyle = "logo", onDirty, savedAt = "" }: {
  view: BowlTicketData;
  onSave: (picks: Record<string, BowlSide>, guess: string) => Promise<string | void> | string | void;
  onOptOut?: () => void;
  flagStyle?: "name" | "logo";
  onDirty?: (save: (() => Promise<boolean>) | null) => void;
  /** When the picks were last saved ("7:42 PM"), kept by the page across the ticket being read again after a save. */
  savedAt?: string;
}) {
  const [tab, setTab] = useState<"picks" | "standings" | "sheet">("picks");
  const [picks, setPicks] = useState<Record<string, BowlSide>>(view.saved);
  const [guess, setGuess] = useState(view.guess);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const open = (game: BowlTicketGame) => !game.locked;
  const changed = view.games.some((game) => open(game) && picks[game.id] !== view.saved[game.id]) || guess !== view.guess;
  const changes = view.games.filter((game) => open(game) && picks[game.id] !== view.saved[game.id]).length + (guess !== view.guess ? 1 : 0);
  const days = useMemo(() => [...new Set(view.games.map((game) => game.day))], [view.games]);
  const pickedCount = view.games.filter((game) => picks[game.id]).length;

  const choose = (game: BowlTicketGame, side: BowlSide) => {
    setProblem("");
    const next = { ...picks };
    if (next[game.id] === side) { delete next[game.id]; haptic("lightTick"); } else { next[game.id] = side; haptic("tick"); }
    setPicks(next);
  };

  async function save(): Promise<boolean> {
    setSending(true);
    setProblem("");
    try {
      const answer = await onSave(picks, guess);
      if (typeof answer === "string") { setProblem(answer); return false; }
      return true;
    } finally { setSending(false); }
  }
  const saveNow = useStableCallback(save);
  useEffect(() => { onDirty?.(changed ? saveNow : null); }, [changed, onDirty, saveNow]);
  useEffect(() => () => onDirty?.(null), [onDirty]);
  const titleGame = view.games.find((game) => game.tiebreaker) ?? null;

  const caption = (game: BowlTicketGame) => {
    if (game.note) return game.note.toUpperCase();
    if (game.state === "missed") return "MISSED · COUNTS AS A LOSS";
    if (game.final) return "FINAL";
    if (game.locked) return "KICKED OFF";
    return game.time;
  };
  // Where it is played (city, state) rides on the same small line as the time, so a row never grows taller for it.
  const withPlace = (game: BowlTicketGame) => (game.place && !game.note && game.state !== "missed" ? `${caption(game)} · ${game.place}` : caption(game));

  return (
    <div className="lab-bigboard lab-window lab-bowl-ticket trace-gilt">
      {/* One compact block: the title over a single row of figures (to pick, picked, games left, all alike), the season dial beside both. */}
      <header className="lab-bowl-head">
        <h3>Bowl Pool</h3>
        <dl className="lab-bowl-counts">
          {/* Your picks at a glance: how many are still to make (gold while any are) and how many are in. */}
          {view.owed ? <>
            <div className="is-owed"><dt>To pick</dt><dd>{view.owed}</dd></div>
            <div><dt>Picked</dt><dd>{view.picked ?? 0}</dd></div>
          </> : <div className="is-clear"><dt>Picks</dt><dd>{view.decided === view.total && view.total ? "All decided" : "All in"}</dd></div>}
          {view.total > view.decided ? <div className="is-left"><dt>{view.total - view.decided === 1 ? "Game left" : "Games left"}</dt><dd>{view.total - view.decided}</dd></div> : null}
        </dl>
        <BowlGauge bare played={view.decided} total={view.total} />
      </header>

      <div aria-label="Bowl Pool view" className="lab-chips lab-ticket-switch lab-ticket-action" role="group">
        <button aria-pressed={tab === "picks"} onClick={() => { haptic("tick"); setTab("picks"); }} type="button">Picks</button>
        {/* With the sheet (the real Bowl Pool) the standings are its first column, so there is no separate Standings tab. */}
        {view.sheet ? <button aria-pressed={tab === "sheet"} onClick={() => { haptic("tick"); setTab("sheet"); }} type="button">Sheet</button> : <button aria-pressed={tab === "standings"} onClick={() => setTab("standings")} type="button">Standings</button>}
      </div>

      {/* Everything under the heading scrolls as one, under the heading that stands still. */}
      <div className="lab-window-scroll">
      {tab === "picks" ? <>
        <section aria-label="Bowl picks" className="lab-window-part">
          {view.games.length === 0 ? <p className="lab-board-note">The bowl schedule is not set yet.</p> : null}
          {days.map((day) => {
            // Each game day is its own card, headed by a gold tab for the weekday, the date beside it, and how many games that day has.
            const games = view.games.filter((game) => game.day === day);
            const [weekday, ...date] = day.split(" ");
            const dated = date.length > 0 && weekday !== "DATE";
            return (
            <div className="lab-bowl-day" key={day}>
              <h4>{dated ? <><b>{weekday}</b><span>{date.join(" ")}</span></> : <span>{day}</span>}<small>{games.length} {games.length === 1 ? "GAME" : "GAMES"}</small></h4>
              <ol>
                {games.map((game) => {
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
                        {flagStyle === "logo" && (game.logo || game.playoff) ? (game.logo ? <BowlLogoFlag cloth={game.cloth} hoist={game.hoist} logo={game.logo} state={game.state} /> : <BowlLogoFlag cloth="rgb(0 0 0)" hoist="rgb(200 158 62)" logo={CFP_LOGO} state={game.state} />) : <BowlFlag flag={game.flag} state={game.state} />}
                        <span>{game.round === "Quarterfinal" || game.round === "Semifinal" ? <em className="lab-bowl-round">CFP {game.round}</em> : null}<b>{game.bowl}</b><small>{withPlace(game)}</small></span>
                      </span>
                      {cell(0)}
                      <span aria-hidden="true" className="lab-board-at">vs</span>
                      {cell(1)}
                      {game.tiebreaker ? (
                        <label className={`lab-bowl-guess${!guess && !view.tiebreakerLocked ? " is-empty" : ""}`}>
                          <span><b>Tiebreaker</b> Your guess of the total points both teams score in the {game.bowl}. Closest wins.</span>
                          <input aria-label="Tiebreaker: total points in the title game" disabled={view.tiebreakerLocked} inputMode="numeric" maxLength={3} onChange={(event) => { setProblem(""); setGuess(event.target.value.replace(/\D/g, "")); }} placeholder="e.g. 48" value={guess} />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
            );
          })}
        </section>

        <section aria-label="Your bowl ticket" className="lab-window-ticket">
          <dl>
            <div><dt>Picked</dt><dd>{pickedCount} of {view.total}</dd></div>
            <div><dt>Still to pick</dt><dd>{view.owed || "None"}</dd></div>
          </dl>
          {problem ? <p className="lab-window-problem" role="alert">{problem}</p> : savedAt && !changed && !guess && titleGame && !view.tiebreakerLocked ? <p className="lab-window-problem" role="status">Picks saved. Don’t forget your tiebreaker above.</p> : null}
          {onOptOut && view.entryOpen ? <button className="lab-bowl-optout" onClick={onOptOut} type="button">Opt out of the Bowl Pool</button> : null}
        </section>
        {/* Save rides a bar pinned to the foot of the ticket while there is something to save, so it is never a scroll away. */}
        <SaveBar changes={changes} pinned={changed}>
          <button className="lab-window-submit" disabled={!changed || sending} onClick={() => void save()} type="button">{sending ? "Saving…" : changed ? "Save picks" : savedAt ? `Saved at ${savedAt} ✓` : "Saved ✓"}</button>
        </SaveBar>
      </> : tab === "sheet" && view.sheet ? <BowlSheet sheet={view.sheet} /> : (
        <section aria-label="Bowl standings" className="lab-window-part">
          <h4>STANDINGS<small>{view.decided ? `after ${view.decided} of ${view.total} bowls` : "no bowls played yet"}</small></h4>
          {view.standings.length === 0 ? <p className="lab-board-note">No one has claimed a seat yet.</p> : null}
          <ol className="lab-bowl-standings">
            {view.standings.map((row) => (
              <li className={row.you ? "is-you" : ""} key={row.id}>
                <span>{row.tied ? `T${row.place}` : row.place}</span>
                <b><PlayerTrophyName name={row.name} showTrophy={Boolean(row.holdsTrophy)} titles={row.trophies} /></b>
                <em>{row.wins} {row.wins === 1 ? "WIN" : "WINS"}</em>
              </li>
            ))}
          </ol>
        </section>
      )}
      </div>
    </div>
  );
}

/**
 * The whole Bowl Pool on one sheet (the classic Bowl Card), in the ticket's navy: a row per player in standings order with their record,
 * a column per bowl under its short name and day. It scrolls sideways with the record and name held still, and opens on today's bowls.
 * A kicked-off bowl shows each player's school in the result's colour; before kickoff a lit lamp means a pick is in, unlit means none
 * yet (nobody else's pick is shown before kickoff). Your own row always shows your picks.
 */
function BowlSheet({ sheet }: { sheet: BowlSheetData }) {
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || sheet.todayIndex < 1) return;
    const column = node.querySelectorAll<HTMLElement>("thead th.lab-bowl-sheet-game")[sheet.todayIndex];
    const held = node.querySelector<HTMLElement>("thead th.lab-bowl-sheet-game");
    if (column && held) node.scrollLeft = column.offsetLeft - held.offsetLeft;
  }, [sheet.todayIndex]);
  // The bowls clumped by day, in order: each day's label and how many bowls it has, and which columns start a day.
  const days = sheet.games.reduce<Array<{ label: string; start: number; count: number }>>((list, game, index) => {
    const last = list.at(-1);
    if (last && last.label === game.day) last.count += 1;
    else list.push({ label: game.day, start: index, count: 1 });
    return list;
  }, []);
  const dayStart = new Set(days.map((day) => day.start));
  const cell = (value: BowlSheetCell, player: string, bowl: string) => {
    if (value.kind === "hidden") return <Lamp label={`${player}, ${bowl}: pick in, hidden until kickoff`} state="in" />;
    if (value.kind === "pick") return <b aria-label={`${player}, ${bowl}: ${value.team}${value.result === "W" ? ", won" : value.result === "L" ? ", lost" : ""}`} className={`lab-bowl-sheet-pick is-${value.result ? value.result.toLowerCase() : "open"}`}>{value.team}</b>;
    if (value.result === "L") return <b aria-label={`${player}, ${bowl}: no pick, a loss`} className="lab-bowl-sheet-pick is-l">—</b>;
    if (value.missed) return <b aria-label={`${player}, ${bowl}: no pick`} className="lab-bowl-sheet-pick is-missed">—</b>;
    return <Lamp label={`${player}, ${bowl}: no pick`} state="off" />;
  };
  return (
    <section aria-label="Bowl sheet" className="lab-window-part lab-bowl-sheet">
      <div aria-label="Bowl sheet, scrolls sideways" className="lab-bowl-sheet-scroll" ref={scroller} role="region" tabIndex={0}>
        <table style={{ width: `calc(8.7rem + ${sheet.games.length} * 6.6rem + 6.2rem)` }}>
          <colgroup><col className="lab-bowl-sheet-col-rec" /><col className="lab-bowl-sheet-col-name" />{sheet.games.map((game) => <col className="lab-bowl-sheet-col-game" key={game.id} />)}<col className="lab-bowl-sheet-col-tb" /></colgroup>
          <thead>
            {/* Three heading rows: each day over its bowls (as the classic Bowl Card clumps them), the bowl names (centred on one line with
                each other however many lines each takes), then each bowl's schools and spreads. */}
            <tr>
              <th className="lab-bowl-sheet-rec" rowSpan={3} scope="col">Wins</th>
              <th className="lab-bowl-sheet-name" rowSpan={3} scope="col">Player</th>
              {days.map((day) => <th className="lab-bowl-sheet-day is-day-start" colSpan={day.count} key={day.start} scope="colgroup"><span>{day.label}</span></th>)}
              {/* Last, as on the classic Bowl Card: each player's guess of the total points in the title game. */}
              <th className="lab-bowl-sheet-tb" rowSpan={3} scope="col">Tiebreaker</th>
            </tr>
            <tr>
              {sheet.games.map((game, index) => <th className={`lab-bowl-sheet-game${dayStart.has(index) ? " is-day-start" : ""}`} key={game.id} scope="col">{game.name}</th>)}
            </tr>
            <tr>
              {sheet.games.map((game, index) => <th className={`lab-bowl-sheet-lines${dayStart.has(index) ? " is-day-start" : ""}`} key={game.id}><span className="lab-bowl-sheet-matchup">{game.matchup.every((side) => side.team === "TBD") ? <span className="is-tbd">Teams TBD</span> : game.matchup.map((side, index) => <span key={index}><b>{side.team}</b> <i>{side.line}</i></span>)}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr className={row.you ? "is-you" : undefined} key={row.id}>
                <td className="lab-bowl-sheet-rec"><BowlScoreTile landDelay={(rowIndex + 1) * 90} settled value={row.wins} /></td>
                <th className="lab-bowl-sheet-name" scope="row"><PlayerTrophyName name={row.name} showTrophy={Boolean(row.holdsTrophy)} titles={row.trophies} /></th>
                {row.cells.map((value, index) => <td className={dayStart.has(index) ? "is-day-start" : undefined} key={sheet.games[index].id}>{cell(value, row.name, sheet.games[index].name)}</td>)}
                <td aria-label={`${row.name}, tiebreaker: ${row.tiebreaker ?? "none yet"}`} className="lab-bowl-sheet-tb">{row.tiebreaker ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * The bowl's name pennant: a tapered felt pennant with a gold hoist, lettered with the bowl's short name. Gold while a pick is owed, navy once
 * picked, grey when the bowl kicked off without one.
 */
export function BowlFlag({ flag, state, small = false }: { flag: string; state: BowlRowState; small?: boolean }) {
  const size = flag.length > 7 ? 11 : flag.length > 4 ? 13 : 16;
  return (
    <span aria-hidden="true" className={`lab-bowl-flag is-${state} ${small ? "is-small" : ""}`}>
      <svg focusable="false" viewBox="0 0 108 40">
        <path className="lab-bowl-flag-cloth" d="M8 1L106 7.2V32.8L8 39Z" />
        <rect className="lab-bowl-flag-hoist" height="40" rx="2" width="9" x="0" y="0" />
        <text className="lab-bowl-flag-name" fontSize={small ? 22 : size} x={small ? 40 : 14} y="21" {...(flag.length > 7 ? { lengthAdjust: "spacingAndGlyphs", textLength: 66 } : {})}>{flag}</text>
      </svg>
    </span>
  );
}

/** A playoff game with no bowl of its own (a first-round game on campus) flies the College Football Playoff's logo, on black cloth (the logo's own ground). */
const CFP_LOGO = "cfp";
/** Logos drawn in light lines (gold or white on dark) sit straight on their dark cloth: on the cream patch they would wash out. */
const BARE_LOGOS = new Set([CFP_LOGO, "las-vegas", "la"]);

/**
 * The bowl's banner: a tapered pennant (a trapezoid, full height at the hoist, narrower at the fly, no point) in the logo's own colours
 * with the real logo, in full colour, on a cream patch of the same taper so every logo reads, dark or light. The logo sits
 * toward the hoist, where the cloth is tallest, and fits inside it. It hangs still; it greys when the bowl kicked off without a pick.
 */
export function BowlLogoFlag({ logo, cloth, hoist, state }: { logo: string; cloth: string | null; hoist: string | null; state: BowlRowState }) {
  const medal = `medal-${useId().replace(/:/g, "")}`;
  return (
    <span aria-hidden="true" className={`lab-bowl-flag is-logo is-${state}`} style={{ "--flag-cloth": cloth ?? undefined, "--flag-hoist": hoist ?? undefined } as CSSProperties}>
      <svg focusable="false" viewBox="0 0 136 56">
        <defs>
          {/* Felt catching the light: a little brighter up by the pole, falling off toward the fly and the lower edge. */}
          <linearGradient id={`${medal}-felt`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="rgb(255 255 255)" stopOpacity=".16" />
            <stop offset=".45" stopColor="rgb(255 255 255)" stopOpacity="0" />
            <stop offset="1" stopColor="rgb(0 0 0)" stopOpacity=".22" />
          </linearGradient>
          {/* The pole: round, lit down its left side. */}
          <linearGradient id={`${medal}-pole`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgb(255 255 255)" stopOpacity=".38" />
            <stop offset=".45" stopColor="rgb(255 255 255)" stopOpacity="0" />
            <stop offset="1" stopColor="rgb(0 0 0)" stopOpacity=".3" />
          </linearGradient>
        </defs>
        <path className="lab-bowl-flag-cloth" d="M10 1.5L135 11.6V44.4L10 54.5Z" strokeLinejoin="round" />
        <path d="M10 1.5L135 11.6V44.4L10 54.5Z" fill={`url(#${medal}-felt)`} />
        {/* Stitched round the edge, just inside it. */}
        <path className="lab-bowl-flag-stitch" d="M13 4.6L132 14.2V41.8L13 51.4Z" strokeLinejoin="round" />
        <rect className="lab-bowl-flag-hoist" height="56" rx="3" width="10" x="1" y="0" />
        <rect fill={`url(#${medal}-pole)`} height="56" rx="3" width="10" x="1" y="0" />
        {BARE_LOGOS.has(logo) ? null : <path className="lab-bowl-flag-patch" d="M17 7L128 16V40L17 49Z" strokeLinejoin="round" />}
        {/* The logo struck like a silver medallion: a fine bright rim round its outline, a darker silver edge just below it for its
            thickness, and a soft shadow on the cloth. */}
        <filter colorInterpolationFilters="sRGB" height="140%" id={medal} width="140%" x="-20%" y="-20%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.7" result="rim" />
          <feOffset dy="1.2" in="rim" result="edgeShape" />
          <feFlood floodColor="rgb(120 128 140)" />
          <feComposite in2="edgeShape" operator="in" result="edge" />
          <feFlood floodColor="rgb(226 230 236)" />
          <feComposite in2="rim" operator="in" result="rimLit" />
          <feGaussianBlur in="edgeShape" result="blurred" stdDeviation="1.1" />
          <feOffset dy="1" in="blurred" result="dropShape" />
          <feFlood floodColor="rgba(0, 0, 0, .35)" />
          <feComposite in2="dropShape" operator="in" result="drop" />
          <feMerge><feMergeNode in="drop" /><feMergeNode in="edge" /><feMergeNode in="rimLit" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <image filter={`url(#${medal})`} height="50" href={`/bowl-logos/${logo}.webp`} preserveAspectRatio="xMidYMid meet" width="104" x="9" y="3" />
      </svg>
    </span>
  );
}

/** The moon at a phase (0 new, 1/2 half, 1 full), waxing: the lit part on the right, its inner edge an ellipse. */
function moonLight(cx: number, cy: number, r: number, lit: number) {
  if (lit >= 1) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}Z`;
  const edge = Math.abs(1 - 2 * lit) * r;
  return `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}A${edge.toFixed(2)} ${r} 0 0 ${lit < 0.5 ? 0 : 1} ${cx} ${cy - r}Z`;
}

const PHASES = [0, 0.25, 0.5, 0.75, 1];

/**
 * How much of bowl season is decided, as the moon waxing over the night sky: a half-dial from a new moon to a full one, its marks the
 * moon's phases (new, crescent, half, gibbous, full) in place of fractions (no stars: up close they read as specks); each moon lights as the season passes it, the needle points
 * at the share decided, and the bowls left are read out beneath.
 */
export function BowlGauge({ played, total, bare = false }: { played: number; total: number; /** no games-left caption (the ticket's heading counts them) */ bare?: boolean }) {
  const id = useId().replace(/:/g, "");
  const share = total ? Math.min(1, played / total) : 0;
  const point = (fraction: number, radius: number) => {
    const angle = Math.PI * (1 - fraction);
    return { x: 60 + radius * Math.cos(angle), y: 58 - radius * Math.sin(angle) };
  };
  const end = point(share, 36);
  const left = Math.max(0, total - played);
  // The needle: a tapered blade from the hub to the dial, with a short counterweight behind the hub, as an instrument's has.
  const angle = Math.PI * (1 - share);
  const along = (radius: number, side: number) => ({ x: 60 + radius * Math.cos(angle) - side * Math.sin(angle), y: 58 - radius * Math.sin(angle) - side * Math.cos(angle) });
  const needle = [along(30, 0), along(0, 1.7), along(-7, 1.1), along(-7, -1.1), along(0, -1.7)].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  return (
    <figure aria-label={left ? `${left} of ${total} games left` : `All ${total} games played`} className={`lab-bowl-gauge${bare ? " is-bare" : ""}`} role="img">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 120 66">
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgb(150 110 50)" />
            <stop offset="1" stopColor="rgb(240 200 110)" />
          </linearGradient>
          <radialGradient id={`${id}-hub`} cx=".35" cy=".35" r=".8">
            <stop offset="0" stopColor="rgb(255 236 180)" />
            <stop offset="1" stopColor="rgb(160 118 52)" />
          </radialGradient>
        </defs>
        {/* the dial's bezel: a fine gold rim outside the track and a fainter one inside it */}
        <path className="lab-bowl-gauge-bezel" d="M17 58A43 43 0 0 1 103 58" />
        <path className="lab-bowl-gauge-bezel is-inner" d="M29 58A31 31 0 0 1 91 58" />
        {/* the scale: a tick every 1/24 of the season, longer at each quarter */}
        {Array.from({ length: 25 }, (_, index) => {
          const fraction = index / 24, major = index % 6 === 0;
          const outer = point(fraction, 41.5), inner = point(fraction, major ? 38.6 : 39.8);
          return <line className={`lab-bowl-gauge-tick${fraction <= share ? " is-passed" : ""}${major ? " is-major" : ""}`} key={index} x1={outer.x.toFixed(2)} x2={inner.x.toFixed(2)} y1={outer.y.toFixed(2)} y2={inner.y.toFixed(2)} />;
        })}
        <path className="lab-bowl-gauge-track" d="M24 58A36 36 0 0 1 96 58" />
        {share > 0 ? <path className="lab-bowl-gauge-fill" d={`M24 58A36 36 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} stroke={`url(#${id}-fill)`} /> : null}
        {PHASES.map((phase) => {
          const at = point(phase, 50);
          const reached = share >= phase - 0.001 && (phase > 0 || share > 0);
          return (
            <g className={`lab-bowl-moon${reached ? " is-reached" : ""}`} key={phase}>
              <circle className="lab-bowl-moon-dark" cx={at.x} cy={at.y} r="5.4" />
              {phase > 0 ? <path className="lab-bowl-moon-lit" d={moonLight(at.x, at.y, 5.4, phase)} /> : null}
            </g>
          );
        })}
        <polygon className="lab-bowl-gauge-needle" points={needle} />
        <circle className="lab-bowl-gauge-hub" cx="60" cy="58" fill={`url(#${id}-hub)`} r="3.6" />
        <circle className="lab-bowl-gauge-pin" cx="60" cy="58" r="1.2" />
      </svg>
      {bare ? null : <figcaption>{left ? <><BowlScoreTile label={`${left} left`} large settled value={left} /> {left === 1 ? "GAME" : "GAMES"} LEFT</> : "ALL PLAYED"}</figcaption>}
    </figure>
  );
}
