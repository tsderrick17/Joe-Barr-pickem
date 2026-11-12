"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import AtsResultStamp from "@/components/ats-result-stamp";
import SurvivorPokerChip from "@/components/survivor-poker-chip";
import { LAB_MOMENTS, LAB_VIEWER, labKickedOff, labLeaderboard, labStandard, labSurvivorBoard } from "@/lib/lab-clubhouse.js";
import { LAB_SLATE, LAB_TEAM_NAMES, labLineFor } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * Lab try-out: the pages as rooms of one clubhouse, each keeping its own character, with the sample league only.
 *  - Standings: the clubhouse leaderboard of hand-set number plates, and each player's picks on a golf standard (the white sign on a
 *    pole carried round the course), raised by tapping their row or all at once "on the course".
 *  - The Slate: the big board, a gilt frame drawn round a pick, and Survivor picked on the same board.
 *  - Trophy Room: engraved brass plaques on walnut, the season's countdown, and a new champion's pennant swinging in.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

type Room = "standings" | "slate" | "trophies";
const ROOMS: Array<{ id: Room; label: string }> = [
  { id: "standings", label: "Standings" },
  { id: "slate", label: "The Slate" },
  { id: "trophies", label: "Trophy Room" },
];

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
          <div aria-hidden="true" className="lab-leaderboard-heads"><span>POS</span><span>PLAYER</span><span>WINS</span><span>BACK</span></div>
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

function SlateRoom() {
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
        <Chips label="Pick highlight" onChange={setTrace} options={[["gilt", "Gilt edge"], ["brass", "Brass inlay"], ["lit", "Lit line"]] as const} value={trace} />
      </div>
      <div className={`lab-bigboard is-${mode} trace-${trace}`}>
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
/** Titles a player had in a pool up to and including a season: the stars engraved beside their name. */
const titlesTo = (pool: Pool, name: string, season: string) => CHAMPIONS.filter((year) => year.season <= season && year[pool] === name).length;

/** A small engraved mark for each pool: crossed pencils (Pick'em), a chip (Survivor), a pennant (Bowl Pool). */
function PoolMark({ pool }: { pool: Pool }) {
  return (
    <svg aria-hidden="true" className="lab-plaque-mark" focusable="false" viewBox="0 0 12 12">
      {pool === "pickem" ? <><path d="M2 10 9.5 2.5M10 10 2.5 2.5" /><path d="M1.6 10.4 2.6 9.4M10.4 10.4 9.4 9.4" /></> : null}
      {pool === "survivor" ? <><circle cx="6" cy="6" r="4.6" /><circle cx="6" cy="6" r="2.2" /><path d="M6 1.4V3M6 9V10.6M1.4 6H3M9 6H10.6" /></> : null}
      {pool === "bowl" ? <><path d="M2.2 1.5V11" /><path d="M2.6 2 10.2 4.6 2.6 7.2Z" /></> : null}
    </svg>
  );
}

/** A laurel sprig engraved at the top of each plaque: two curved branches of leaves meeting at a small stem. */
function Laurel() {
  const leaves = [0, 1, 2, 3];
  return (
    <svg aria-hidden="true" className="lab-plaque-laurel" focusable="false" viewBox="0 0 60 16">
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(30 14) scale(${side} 1)`}>
          <path d="M1 0C8 0 16 -3 24 -9" />
          {leaves.map((index) => <ellipse cx={6 + index * 5.2} cy={-1.4 - index * 1.9} key={index} rx="2.6" ry="1.1" transform={`rotate(${-18 - index * 6} ${6 + index * 5.2} ${-1.4 - index * 1.9})`} />)}
          {leaves.map((index) => <ellipse cx={8 + index * 5.2} cy={1.6 - index * 2.3} key={`b${index}`} rx="2.4" ry="1" transform={`rotate(${22 - index * 9} ${8 + index * 5.2} ${1.6 - index * 2.3})`} />)}
        </g>
      ))}
    </svg>
  );
}

function Plaque({ year }: { year: (typeof CHAMPIONS)[number] }) {
  return (
    <article aria-label={`${year.season} champions`} className="lab-plaque">
      <span aria-hidden="true" className="lab-plaque-screws" />
      <div className="lab-plaque-plate">
        <Laurel />
        <p className="lab-plaque-season">{year.season}</p>
        <dl>
          {(["pickem", "survivor", "bowl"] as const).map((pool) => (
            <div key={pool}>
              <dt><PoolMark pool={pool} />{POOL_LABEL[pool]}</dt>
              <dd>{year[pool]}<span aria-label={`${titlesTo(pool, year[pool], year.season)} titles`} className="lab-plaque-stars">{"★".repeat(titlesTo(pool, year[pool], year.season))}</span></dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

function TrophyRoom() {
  const [scene, setScene] = useState<"wall" | "crowning">("wall");
  const [crownings, setCrownings] = useState(0);
  return (
    <div className="lab-room-stack">
      <div className="lab-room-controls">
        <Chips label="Scene" onChange={(next) => { setScene(next); if (next === "crowning") setCrownings((count) => count + 1); }} options={[["wall", "The wall"], ["crowning", "A champion is crowned"]] as const} value={scene} />
      </div>
      <div className="lab-case">
        <header>
          <h3>Trophy Room</h3>
          <p>Every champion, kept under glass.</p>
          <div className="lab-case-countdown"><span>THE 2027 SEASON OPENS AUG 1</span><strong>172 DAYS</strong><small>sample date: Feb 10</small></div>
        </header>
        {scene === "crowning" ? (
          <div className="lab-crowning" key={crownings}>
            <span aria-hidden="true" className="lab-crowning-rod" />
            <div className="lab-pennant" role="img" aria-label="2026 Pick'em champion: Earl">
              <span>2026 CHAMPION</span>
              <strong>EARL</strong>
              <small>PICK’EM</small>
            </div>
          </div>
        ) : null}
        <div className="lab-case-shelf">
          {CHAMPIONS.map((year) => <Plaque key={year.season} year={year} />)}
        </div>
      </div>
    </div>
  );
}

export function LabClubhouse() {
  const [room, setRoom] = useState<Room>("standings");
  return (
    <section aria-label="Clubhouse try-out" className="lab-clubhouse" data-room={room}>
      <nav aria-label="Clubhouse rooms" className="lab-doors">
        {ROOMS.map((item) => <button aria-pressed={room === item.id} key={item.id} onClick={() => setRoom(item.id)} type="button"><span aria-hidden="true" className="lab-door-knob" />{item.label}</button>)}
      </nav>
      {room === "standings" ? <StandingsRoom /> : null}
      {room === "slate" ? <SlateRoom /> : null}
      {room === "trophies" ? <TrophyRoom /> : null}
    </section>
  );
}
