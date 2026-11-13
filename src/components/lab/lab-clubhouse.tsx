"use client";

import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import TrophyBanner from "@/components/trophy-banner";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { BigBoardRoom, WindowRoom } from "@/components/lab/lab-tote";
import { LAB_VIEWER, labLeaderboard, labStandard } from "@/lib/lab-clubhouse.js";
import { labSurvivorAt } from "@/lib/lab-samples.js";

/**
 * Lab try-out: the whole pool as one clubhouse, with the sample league only. Built for a phone first.
 *  - The lobby is one room drawn to fit one phone screen. Everything in it is a big, labelled thing to tap, and each shows a line of
 *    live news, so many visits need no tap at all. One tap opens a room; one "Back to Clubhouse" button at the top of every room goes
 *    back. No swiping.
 *  - The Big Board (the centrepiece): everyone's picks in one place, Survivor's chips beside them, and the standings on the same board.
 *  - The Window: every pick a player makes in one place, Pick'em and Survivor, on one ticket with one Submit.
 *  - Trophy Room: one tall wall to scroll, the way you would look at a real one: the champions' banners up in the rafters (the real
 *    banners), the three trophies on the mantle (the real trophies), and a brass plaque for every season down the front of the bar.
 *  - Survivor: the card table, for who is still in and every chip played. The Bowl Pool corner is a stand-in.
 *  - The pool chat is a slim sign by the door, not a room in the middle: few people use it.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

type Room = "board" | "window" | "trophies" | "survivor" | "bowl" | "chat";
const ROOM_TITLE: Record<Room, string> = { board: "The Big Board", window: "The Window", trophies: "Trophy Room", survivor: "Survivor", bowl: "Bowl Pool", chat: "Pool chat" };

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="lab-chips" role="group">
      {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
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
  const mine = labStandard(LAB_VIEWER, { round: "regular", moment: "before" });
  const slots = [...mine.slats.map((slat) => Boolean(slat.team)), Boolean(mine.survivor?.team)];
  const seats = labSurvivorAt(9);
  return (
    <nav aria-label="Clubhouse rooms" className="lab-lobby">
      <p className="lab-lobby-sign">Lead Pipe Locks Clubhouse</p>
      <span aria-hidden="true" className="lab-lobby-floor" />
      <Fixture news={`Everyone’s picks · Leader: ${rows[0].name} · You: ${you?.tied ? "T" : ""}${you?.place ?? ""}`} onEnter={onEnter} room="board">
        <span aria-hidden="true" className="lab-fixture-plates">{rows.slice(0, 3).map((row) => <i key={row.name}><b>{row.wins}</b><b>{row.name.toUpperCase()}</b></i>)}</span>
      </Fixture>
      <Fixture news={`Your picks: ${slots.filter(Boolean).length} of ${slots.length} in`} onEnter={onEnter} room="window">
        <span aria-hidden="true" className="lab-fixture-slots">{slots.map((lit, index) => <i className={lit ? "is-lit" : ""} key={index} />)}</span>
      </Fixture>
      <Fixture news="Banners, trophies, plaques" onEnter={onEnter} room="trophies">
        <Image alt="" className="lab-fixture-trophies" height={990} sizes="12rem" src="/trophies/turntable/sm/rest-0.webp" width={1320} />
      </Fixture>
      <Fixture news={`${seats.filter((seat) => !seat.out).length} of ${seats.length} alive`} onEnter={onEnter} room="survivor" />
      <Fixture news="Opens Dec 7" onEnter={onEnter} room="bowl" />
      <p className="lab-lobby-hint">Tap anything in the room to open it.</p>
      <button className="lab-lobby-chat" onClick={() => onEnter("chat")} type="button">Pool chat · 3 new <span aria-hidden="true">›</span></button>
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
      {room === "board" ? <BigBoardRoom /> : null}
      {room === "window" ? <WindowRoom /> : null}
      {room === "trophies" ? <TrophyRoom /> : null}
      {room === "survivor" ? <LabSurvivorTable /> : null}
      {room === "chat" ? <StandIn>The pool chat opens here, exactly as it works today.</StandIn> : null}
      {room === "bowl" ? <StandIn>The Bowl Pool opens here, exactly as it works today.</StandIn> : null}
    </section>
  );
}
