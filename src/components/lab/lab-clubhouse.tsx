"use client";

import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import AtsResultStamp from "@/components/ats-result-stamp";
import SurvivorPokerChip from "@/components/survivor-poker-chip";
import TrophyBanner from "@/components/trophy-banner";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { LAB_MOMENTS, LAB_VIEWER, labKickedOff, labLeaderboard, labStandard, labSurvivorBoard } from "@/lib/lab-clubhouse.js";
import { LAB_SLATE, LAB_TEAM_NAMES, labLineFor, labSurvivorAt } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * Lab try-out: the whole pool as one clubhouse, with the sample league only. Built for a phone first.
 *  - The lobby is one room drawn to fit one phone screen. Everything in it is a big, labelled thing to tap (the standings board, the
 *    Slate chalkboard, the trophy mantle, the bar, the Survivor table, the Bowl Pool corner), and each shows a line of live news, so
 *    many visits need no tap at all. One tap opens a room; one "Back to Clubhouse" button at the top of every room goes back. No swiping.
 *  - Standings: the leaderboard of hand-set number plates, and each player's picks on a golf standard.
 *  - The Slate: the big board, a gilt line drawn round a pick, and Survivor picked on the same board.
 *  - Trophy Room: one tall wall to scroll, the way you would look at a real one: the champions' banners up in the rafters (the real
 *    banners), the three trophies on the mantle (the real trophies), and a brass plaque for every season down the front of the bar.
 *  - Survivor: the card table. The bar and the Bowl Pool corner are stand-ins that say what will open there.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

type Room = "standings" | "slate" | "trophies" | "survivor" | "bar" | "bowl";
const ROOM_TITLE: Record<Room, string> = { standings: "Standings", slate: "The Slate", trophies: "Trophy Room", survivor: "Survivor", bar: "The Bar", bowl: "Bowl Pool" };

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="lab-chips" role="group">
      {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
    </div>
  );
}

function Logo({ team }: { team: string }) {
  return <Image alt="" className="lab-room-logo" height={24} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={24} />;
}

const MOMENTS = LAB_MOMENTS.map((moment) => [moment.id, moment.label] as const);

/* ---------------------------------------------------------------- Standings ---------------------------------------------------------------- */

/** One player's standard: a white sign on a pole, their name on the top slat and a slat per pick, the Survivor chip on a hook. */
function Standard({ name, round, moment }: { name: string; round: "regular" | "wildcard"; moment: string }) {
  const standard = labStandard(name, { round, moment });
  return (
    <figure aria-label={`${name}'s picks`} className="lab-standard">
      <div className="lab-standard-sign">
        <p className="lab-standard-name">{name.toUpperCase()}{name === LAB_VIEWER ? <small> · YOU</small> : null}</p>
        <ol>
          {standard.slats.map((slat) => (
            <li className={slat.hidden ? "is-hidden" : slat.result ? `is-${slat.result.toLowerCase()}` : "is-live"} key={slat.gameId}>
              {slat.hidden
                ? <span aria-label="Hidden until kickoff" className="lab-standard-lock" role="img">🔒</span>
                : <><b>{slat.team}</b><span>{slat.line}</span>{slat.result ? <AtsResultStamp result={slat.result} tilted={false} variant="ticket" /> : <i aria-hidden="true" />}</>}
            </li>
          ))}
        </ol>
      </div>
      <span aria-hidden="true" className="lab-standard-pole" />
      {standard.survivor ? (
        <span className="lab-standard-hook">
          {standard.survivor.hidden || !standard.survivor.team
            ? <span aria-label="Survivor pick hidden until kickoff" className="lab-standard-chip-back" role="img" />
            : <SurvivorPokerChip abbreviation={standard.survivor.team} size="summary" teamName={LAB_TEAM_NAMES[standard.survivor.team as keyof typeof LAB_TEAM_NAMES]} />}
        </span>
      ) : null}
    </figure>
  );
}

function StandingsRoom() {
  const [round, setRound] = useState<"regular" | "wildcard">("regular");
  const [moment, setMoment] = useState("gameday");
  const [view, setView] = useState<"board" | "course">("board");
  const [raised, setRaised] = useState<string | null>(LAB_VIEWER);
  const rows = labLeaderboard({ round, moment });
  return (
    <div className="lab-room-stack">
      <div className="lab-room-controls">
        <Chips label="Week" onChange={setRound} options={[["regular", "Week 10"], ["wildcard", "Wild Card"]] as const} value={round} />
        <Chips label="Moment" onChange={setMoment} options={MOMENTS} value={moment} />
        <Chips label="View" onChange={setView} options={[["board", "Leaderboard"], ["course", "On the course"]] as const} value={view} />
      </div>
      {view === "board" ? (
        <div className="lab-leaderboard">
          <header><p>LEAD PIPE LOCKS</p><h3>LEADERS</h3><span>{round === "wildcard" ? "WILD CARD" : "WEEK 10"}</span></header>
          <div aria-hidden="true" className="lab-leaderboard-heads"><span>POS</span><span className="is-player">PLAYER</span><span>WINS</span><span>BACK</span></div>
          <ol>
            {rows.map((row) => (
              <li className={row.out ? "is-out" : ""} key={row.name}>
                <button aria-expanded={raised === row.name} className="lab-leaderboard-row" onClick={() => setRaised(raised === row.name ? null : row.name)} type="button">
                  <span className="lab-plate is-rank">{row.place ? `${row.tied ? "T" : ""}${row.place}` : ""}</span>
                  <span className="lab-plate is-name">{row.name.toUpperCase()}{row.out ? <small>OUT</small> : null}</span>
                  <span className="lab-plate is-wins">{row.wins}</span>
                  <span className="lab-plate is-back">{row.back === null ? "" : row.back === 0 ? "—" : row.back}</span>
                </button>
                {raised === row.name ? <div className="lab-leaderboard-raised"><Standard moment={moment} name={row.name} round={round} /></div> : null}
              </li>
            ))}
          </ol>
          <p className="lab-leaderboard-note">Tap a player to raise their standard.</p>
        </div>
      ) : (
        <div className="lab-course">
          {rows.filter((row) => !row.out).map((row) => <Standard key={row.name} moment={moment} name={row.name} round={round} />)}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- The Slate ---------------------------------------------------------------- */

type Trace = "gilt" | "brass" | "lit";
type SlateScene = "picking" | "gameday" | "out";

/** The Slate's big board. `tote` sets it in the tote board's housing with the gilt line only, as the Tote board try-out shows it. */
export function SlateRoom({ tote = false }: { tote?: boolean }) {
  const [scene, setScene] = useState<SlateScene>("picking");
  const [trace, setTrace] = useState<Trace>("gilt");
  const [mode, setMode] = useState<"ats" | "survivor">("ats");
  const [picks, setPicks] = useState<string[]>(["PIT", "LAR"]);
  const [survivorPick, setSurvivorPick] = useState<string | null>("DEN");
  const moment = scene === "gameday" ? "gameday" : "before";
  const viewer = scene === "out" ? "Hank" : LAB_VIEWER;
  const survivor = labSurvivorBoard({ moment, viewer });
  const chip = survivor.out ? null : survivorPick;

  const choose = (team: string, gameId: string) => {
    if (labKickedOff(LAB_SLATE, gameId, moment)) return;
    if (mode === "survivor") {
      const entry = survivor.teams.find((item) => item.team === team);
      if (entry?.free) setSurvivorPick(survivorPick === team ? null : team);
      return;
    }
    const game = LAB_SLATE.find((item) => item.id === gameId)!;
    const other = team === game.home ? game.away : game.home;
    if (picks.includes(team)) setPicks(picks.filter((pick) => pick !== team));
    else if (picks.length < 2 || picks.includes(other)) setPicks([...picks.filter((pick) => pick !== other), team]);
  };

  return (
    <div className="lab-room-stack">
      <div className="lab-room-controls">
        <Chips label="Moment" onChange={setScene} options={[["picking", "Picking"], ["gameday", "Game day"], ["out", "Out of Survivor"]] as const} value={scene} />
        {tote ? null : <Chips label="Pick highlight" onChange={setTrace} options={[["gilt", "Gilt edge"], ["brass", "Brass inlay"], ["lit", "Lit line"]] as const} value={trace} />}
      </div>
      <div className={`lab-bigboard is-${mode} trace-${tote ? "gilt" : trace}${tote ? " is-tote" : ""}`}>
        <header>
          <h3>THE BOARD</h3>
          <span>WEEK 10 · {mode === "ats" ? `PICKS ${picks.length} OF 2` : survivor.out ? `SURVIVOR · OUT WK ${survivor.outWeek}` : chip ? `SURVIVOR · ${chip}` : "SURVIVOR · OPEN"}</span>
        </header>
        <Chips label="Pool" onChange={setMode} options={[["ats", "Against the spread"], ["survivor", "Survivor"]] as const} value={mode} />
        <ol>
          {LAB_SLATE.map((game) => {
            const locked = labKickedOff(LAB_SLATE, game.id, moment);
            const cell = (team: string): ReactNode => {
              const entry = survivor.teams.find((item) => item.team === team)!;
              const picked = picks.includes(team);
              const disabled = locked || (mode === "survivor" && !entry.free);
              return (
                <button
                  aria-label={`${LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES]} ${labLineFor(game, team)}`}
                  aria-pressed={mode === "ats" ? picked : chip === team}
                  className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""} ${entry.usedWeek ? "is-used" : ""}`}
                  disabled={disabled}
                  onClick={() => choose(team, game.id)}
                  type="button"
                >
                  <span className="lab-board-team"><Logo team={team} />{team}</span>
                  <span className="lab-board-line">{labLineFor(game, team)}</span>
                  {mode === "survivor" && entry.usedWeek ? <span className="lab-board-tag">USED WK {entry.usedWeek}</span> : null}
                  {locked ? <span aria-label="Kicked off" className="lab-board-lock" role="img">🔒</span> : null}
                  {chip === team ? <span className="lab-board-chip"><SurvivorPokerChip abbreviation={team} size="summary" teamName={LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES]} /></span> : null}
                  <span aria-hidden="true" className="lab-board-trace" />
                </button>
              );
            };
            return (
              <li key={game.id}>
                <span className="lab-board-time">{game.kickoff.toUpperCase()}{locked ? " · KICKED OFF" : ""}</span>
                {cell(game.away)}
                <span aria-hidden="true" className="lab-board-at">@</span>
                {cell(game.home)}
              </li>
            );
          })}
        </ol>
        <p className="lab-board-note">{mode === "ats" ? "Tap a team to pick it against the spread." : survivor.out ? "Out of Survivor: the board is read only." : "Survivor: one team a week, straight up. Used teams are marked."}</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Trophy Room ---------------------------------------------------------------- */

type Pool = "pickem" | "survivor" | "bowl";
const POOL_LABEL: Record<Pool, string> = { pickem: "Pick’em", survivor: "Survivor", bowl: "Bowl Pool" };
const CHAMPIONS: Array<{ season: string } & Record<Pool, string>> = [
  { season: "2026", pickem: "Earl", survivor: "Rosie", bowl: "Walt" },
  { season: "2025", pickem: "Walt", survivor: "Dottie", bowl: "Rosie" },
  { season: "2024", pickem: "Earl", survivor: "Walt", bowl: "June" },
  { season: "2023", pickem: "Walt", survivor: "Lou", bowl: "Earl" },
];

/**
 * A season's plaque, kept quiet: satin brass with indented corners on walnut, one engraved keyline, the year over a diamond
 * rule, and each champion at the end of a dotted leader.
 */
function Plaque({ year }: { year: (typeof CHAMPIONS)[number] }) {
  return (
    <article aria-label={`${year.season} champions`} className="lab-plaque">
      <div className="lab-plaque-plate">
        <p className="lab-plaque-season">{year.season}</p>
        <span aria-hidden="true" className="lab-plaque-rule" />
        <dl>
          {(["pickem", "survivor", "bowl"] as const).map((pool) => (
            <div key={pool}>
              <dt>{POOL_LABEL[pool]}</dt>
              <dd>{year[pool]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

/** A pool's champions as the real banners take them: one banner per player, their winning years newest first. */
function bannersFor(pool: Pool) {
  const byPlayer = new Map<string, number[]>();
  for (const year of CHAMPIONS) byPlayer.set(year[pool], [...(byPlayer.get(year[pool]) ?? []), Number(year.season)]);
  return [...byPlayer].map(([name, years]) => ({ name, years }));
}

function TrophyRoom() {
  const [pool, setPool] = useState<Pool>("pickem");
  const [scene, setScene] = useState<"wall" | "crowning">("wall");
  const [crownings, setCrownings] = useState(0);
  const banners = bannersFor(pool);
  return (
    <div className="lab-room-stack">
      <div className="lab-room-controls">
        <Chips label="Scene" onChange={(next) => { setScene(next); if (next === "crowning") setCrownings((count) => count + 1); }} options={[["wall", "The wall"], ["crowning", "A champion is crowned"]] as const} value={scene} />
      </div>
      <div className="lab-case lab-wall">
        <section aria-label="Banners" className="lab-wall-part">
          <h4>Banners <small>a banner for every champion</small></h4>
          <Chips label="Whose banners" onChange={setPool} options={[["pickem", "Pick’em"], ["survivor", "Survivor"], ["bowl", "Bowl Pool"]] as const} value={pool} />
          {scene === "crowning" ? (
            <div className="lab-crowning" key={crownings}>
              <span aria-hidden="true" className="lab-crowning-rod" />
              <div className="lab-pennant" role="img" aria-label="2026 Pick'em champion: Earl">
                <span>2026 CHAMPION</span>
                <strong>EARL</strong>
                <small>PICK’EM</small>
              </div>
            </div>
          ) : (
            <ul aria-label={`${POOL_LABEL[pool]} champions`} className="trophy-rafters lab-wall-rafters" data-pool={pool} key={pool}>
              {banners.map((banner, index) => (
                <li className="trophy-banner" key={banner.name} style={{ "--i": index } as CSSProperties}>
                  <span className="sr-only">{banner.name}: {banner.years.join(", ")}</span>
                  <TrophyBanner index={index} name={banner.name} tag={`${POOL_LABEL[pool]} champion`} years={banner.years} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Trophies" className="lab-wall-part">
          <h4>Trophies <small>one for each pool</small></h4>
          <div className="lab-mantle">
            <Image alt="The Survivor, Pick’em and Bowl Pool trophies" className="lab-mantle-trophies" height={990} sizes="(min-width: 768px) 30rem, 90vw" src="/trophies/turntable/sm/rest-0.webp" width={1320} />
            <span aria-hidden="true" className="lab-mantle-shelf" />
            <ul aria-hidden="true" className="lab-mantle-names"><li>Survivor</li><li>Pick’em</li><li>Bowl Pool</li></ul>
          </div>
        </section>
        <section aria-label="Plaques" className="lab-wall-part">
          <h4>Plaques <small>one for every season</small></h4>
          <div className="lab-case-shelf">
            {CHAMPIONS.map((year) => <Plaque key={year.season} year={year} />)}
          </div>
        </section>
        <div className="lab-case-countdown"><span>THE 2027 SEASON OPENS AUG 1</span><strong>172 DAYS</strong><small>sample date: Feb 10</small></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- The lobby ---------------------------------------------------------------- */

/** One thing in the room to tap: its name, a line of live news, and its own drawing behind them. */
function Fixture({ room, news, onEnter, children }: { room: Room; news: string; onEnter: (room: Room) => void; children?: ReactNode }) {
  return (
    <button className={`lab-fixture is-${room}`} onClick={() => onEnter(room)} type="button">
      {children}
      <span className="lab-fixture-name">{ROOM_TITLE[room]}</span>
      <span className="lab-fixture-news">{news}</span>
    </button>
  );
}

/** The lobby: the whole clubhouse on one phone screen. The news on each fixture comes from the same sample data its room shows. */
function Lobby({ onEnter }: { onEnter: (room: Room) => void }) {
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const you = rows.find((row) => row.name === LAB_VIEWER);
  const picksIn = labStandard(LAB_VIEWER, { round: "regular", moment: "before" }).slats.length;
  const seats = labSurvivorAt(9);
  return (
    <nav aria-label="Clubhouse rooms" className="lab-lobby">
      <p className="lab-lobby-sign">Lead Pipe Locks Clubhouse</p>
      <span aria-hidden="true" className="lab-lobby-floor" />
      <Fixture news={`Leader: ${rows[0].name} · You: ${you?.tied ? "T" : ""}${you?.place ?? ""}`} onEnter={onEnter} room="standings">
        <span aria-hidden="true" className="lab-fixture-plates">{rows.slice(0, 3).map((row) => <i key={row.name}><b>{row.place}</b><b>{row.name.toUpperCase()}</b><b>{row.wins}</b></i>)}</span>
      </Fixture>
      <Fixture news={`Week 10 · ${picksIn} picks in`} onEnter={onEnter} room="slate" />
      <Fixture news="Banners, trophies, plaques" onEnter={onEnter} room="trophies">
        <Image alt="" className="lab-fixture-trophies" height={990} sizes="12rem" src="/trophies/turntable/sm/rest-0.webp" width={1320} />
      </Fixture>
      <Fixture news="Pool chat · 3 new" onEnter={onEnter} room="bar" />
      <Fixture news={`${seats.filter((seat) => !seat.out).length} of ${seats.length} alive`} onEnter={onEnter} room="survivor" />
      <Fixture news="Opens Dec 7" onEnter={onEnter} room="bowl" />
      <p className="lab-lobby-hint">Tap anything in the room to open it.</p>
    </nav>
  );
}

/** A room not built yet: it says plainly what will open here. */
function StandIn({ children }: { children: ReactNode }) {
  return <p className="lab-stand-in">{children}</p>;
}

export function LabClubhouse() {
  const [room, setRoom] = useState<Room | null>(null);
  return (
    <section aria-label="Clubhouse try-out" className="lab-clubhouse" data-room={room ?? "lobby"}>
      {room === null ? <Lobby onEnter={setRoom} /> : (
        <header className="lab-room-bar">
          <button className="lab-room-back" onClick={() => setRoom(null)} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{ROOM_TITLE[room]}</h3>
        </header>
      )}
      {room === "standings" ? <StandingsRoom /> : null}
      {room === "slate" ? <SlateRoom /> : null}
      {room === "trophies" ? <TrophyRoom /> : null}
      {room === "survivor" ? <LabSurvivorTable /> : null}
      {room === "bar" ? <StandIn>The pool chat opens here, exactly as it works today.</StandIn> : null}
      {room === "bowl" ? <StandIn>The Bowl Pool opens here, exactly as it works today.</StandIn> : null}
    </section>
  );
}
