"use client";

import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import TrophyTurntable from "@/components/trophy-turntable";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { BigBoardRoom, WindowRoom } from "@/components/lab/lab-tote";
import { LAB_VIEWER, labLeaderboard } from "@/lib/lab-clubhouse.js";
import { labSurvivorAt } from "@/lib/lab-samples.js";
import ROOM_PICTURES from "@/lib/lab-clubhouse-room.json";

/**
 * Lab try-out: the whole pool as one clubhouse, with the sample league only. Built for a phone first.
 *  - The room: a grand beach bungalow drawn in 3D and shown as one picture (by day, and at night with the pool lit), seen from just
 *    inside, looking down the room under a thatched beach-hut ceiling with two big palm-leaf fans. The floor is clear to walk. Tap
 *    anything to go there: the wall that faces you where picks are made (the Big Board, one screen of spreads, the betting windows
 *    behind their brass grilles; no sign says "sportsbook"), the bar down the left wall (the champions' banners over it, the plaques
 *    along its front, the record book and the laptop on top: the pool chat, a mail sign when there's a new message), the grand
 *    stone chimney on the right (a TV over its mantel, the constitution framed on it, and through the doorway in its near end the
 *    Trophy Room: the same turning table as today), the lounge by the fire with the race on its table, the Survivor poker table in
 *    front, and from Dec 7 the Bowl Pool's bulletin board, wheeled in by the glass doors.
 *  - Only a few things carry a label (where their news is worth a glance); "Show labels" names everything, and a plain list of the
 *    rooms sits under the picture for anyone who would rather tap a word.
 *  - Your ticket is pinned at the bottom of every screen: a lamp for each pick, lit once it is in, and the next deadline; it opens the
 *    Window. The betting windows glow while a pick is still owed.
 *  - One tap opens a room; one "Back to Clubhouse" button at the top of every room goes back. No swiping.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

type Room = "board" | "window" | "trophies" | "survivor" | "bowl" | "chat" | "record" | "constitution" | "race";
const ROOM_TITLE: Record<Room, string> = {
  board: "The Big Board", window: "The Window", trophies: "Trophy Room", survivor: "Survivor", bowl: "Bowl Pool", chat: "Pool chat",
  record: "Record book", constitution: "Constitution", race: "The race",
};

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

/** The Lab's champions in the shape the real Trophy Room takes them, so the real table can stand here. */
const SAMPLE_SEASONS = CHAMPIONS.map((year) => ({ seasonYear: Number(year.season), pickem: [{ name: year.pickem }], survivor: [{ name: year.survivor }], bowl: [{ name: year.bowl }] }));

function TrophyRoom() {
  const [scene, setScene] = useState<"table" | "crowning">("table");
  const [crownings, setCrownings] = useState(0);
  return (
    <div className="lab-room-stack">
      <div className="lab-room-controls">
        <Chips label="Scene" onChange={(next) => { setScene(next); if (next === "crowning") setCrownings((count) => count + 1); }} options={[["table", "The table"], ["crowning", "A champion is crowned"]] as const} value={scene} />
      </div>
      <div className="lab-case lab-wall">
        <section aria-label="Trophies" className="lab-wall-part">
          <h4>Trophies <small>the same table as today: its arrows turn it</small></h4>
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
          <div className="lab-wall-table"><TrophyTurntable seasons={SAMPLE_SEASONS} /></div>
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

/* ---------------------------------------------------------------- The room ---------------------------------------------------------------- */

type Spot = { x: number; y: number; w: number; h: number };
type Picture = { width: number; height: number; spots: Record<string, Spot> };
const PICTURES = ROOM_PICTURES as Record<string, Picture>;

/** Each thing in the picture that can be tapped: where it goes, its name, and whether its label shows without "Show labels". */
const SPOTS: ReadonlyArray<{ spot: string; room: Room; name: string; tag?: string; label?: "above" | "below"; always?: boolean }> = [
  { spot: "sportsbook", room: "window", name: "The Window", label: "below", always: true },
  { spot: "trophies", room: "trophies", name: "Trophy Room", label: "below" },
  { spot: "banners", room: "trophies", name: "Banners", label: "above" },
  { spot: "plaques", room: "trophies", name: "Plaques" },
  { spot: "board", room: "board", name: "The Big Board", label: "above", always: true },
  { spot: "bowl", room: "bowl", name: "Bowl Pool", label: "above", always: true },
  { spot: "record", room: "record", name: "Record book", label: "below" },
  { spot: "chat", room: "chat", name: "Pool chat", tag: "Chat", label: "below" },
  { spot: "constitution", room: "constitution", name: "Constitution", label: "above" },
  { spot: "race", room: "race", name: "The race", label: "above", always: true },
  { spot: "survivor", room: "survivor", name: "Survivor", label: "above", always: true },
];

type Season = "regular" | "bowls";

/** Your ticket, pinned at the bottom of every screen: a lamp for each pick, the next deadline; it opens the Window. */
function Ticket({ allIn, onOpen }: { allIn: boolean; onOpen: () => void }) {
  const lamps = allIn ? [true, true, true] : [true, true, false];
  return (
    <button className="lab-room-ticket" onClick={onOpen} type="button">
      <b>YOUR TICKET · WEEK 10</b>
      <span>{allIn ? "All 3 in · change any until its kickoff" : "2 of 3 in · picks close Thu 8:15 PM"}</span>
      <span aria-hidden="true" className="lab-room-lamps">{lamps.map((lit, index) => <i className={lit ? "is-lit" : ""} key={index} />)}<em>›</em></span>
    </button>
  );
}

/** The room: the picture by day and at night, a tap spot over each thing in it, a few labels, and the plain list of rooms below. */
function ClubRoom({ season, allIn, mail, onEnter }: { season: Season; allIn: boolean; mail: boolean; onEnter: (room: Room) => void }) {
  const [labels, setLabels] = useState(false);
  const key = season === "bowls" ? "-bowl" : "";
  const picture = PICTURES[`day${key}`];
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const you = rows.find((row) => row.name === LAB_VIEWER);
  const seats = labSurvivorAt(9);
  const news: Partial<Record<string, string>> = {
    board: `Leader: ${rows[0].name} · You: ${you?.tied ? "T" : ""}${you?.place ?? ""}`,
    sportsbook: allIn ? "All picks in" : "A pick is owed",
    survivor: `${seats.filter((seat) => !seat.out).length} of ${seats.length} alive`,
    bowl: "Open now",
    race: "Week 10 of 18",
  };
  const spots = SPOTS.filter(({ spot }) => picture.spots[spot]);
  return (
    <>
      <nav aria-label="Clubhouse rooms" className="lab-room" style={{ aspectRatio: `${picture.width} / ${picture.height}` }}>
        <Image alt="The clubhouse: a bright lounge with glass doors onto a pool patio" className="lab-room-picture is-day" height={picture.height * 2} priority src={`/lab/clubhouse/room-day${key}.webp`} unoptimized width={picture.width * 2} />
        <Image alt="The clubhouse at night, the pool lit outside" className="lab-room-picture is-night" height={picture.height * 2} priority src={`/lab/clubhouse/room-night${key}.webp`} unoptimized width={picture.width * 2} />
        {spots.map(({ spot, room, name, tag, label, always }) => {
          const at = picture.spots[spot];
          const style = { left: `${(at.x + at.w / 2) * 100}%`, top: `${(at.y + at.h / 2) * 100}%`, width: `${at.w * 100}%`, height: `${at.h * 100}%` } as CSSProperties;
          const shown = Boolean(label) && (labels || always);
          return (
            <button aria-label={name} className={`lab-room-spot is-${spot}${spot === "sportsbook" && !allIn ? " is-owed" : ""}`} key={spot} onClick={() => onEnter(room)} style={style} type="button">
              {spot === "chat" && mail ? <span aria-label="New message" className="lab-room-mail" role="img">✉</span> : null}
              {shown ? <span aria-hidden="true" className={`lab-room-tag is-${label}`}>{tag ?? name}{news[spot] ? <small>{news[spot]}</small> : null}</span> : null}
            </button>
          );
        })}
        <button aria-pressed={labels} className="lab-room-labels" onClick={() => setLabels(!labels)} type="button">{labels ? "Hide labels" : "Show labels"}</button>
      </nav>
      <div aria-label="Rooms" className="lab-room-list" role="group">
        {(["window", "board", "survivor", "trophies", "race", "record", "constitution", "chat", ...(season === "bowls" ? ["bowl"] : [])] as Room[]).map((room) => (
          <button key={room} onClick={() => onEnter(room)} type="button">{ROOM_TITLE[room]}{room === "chat" && mail ? " · new" : ""}</button>
        ))}
      </div>
    </>
  );
}

/** A room not built yet: it says plainly what will open here. */
function StandIn({ children }: { children: ReactNode }) {
  return <p className="lab-stand-in">{children}</p>;
}

export function LabClubhouse() {
  const [room, setRoom] = useState<Room | null>(null);
  const [season, setSeason] = useState<Season>("regular");
  const [allIn, setAllIn] = useState(false);
  const [mail, setMail] = useState(true);
  return (
    <section aria-label="Clubhouse try-out" className="lab-clubhouse" data-room={room ?? "lobby"}>
      {room === null ? (
        <>
          <div className="lab-room-controls">
            <Chips label="Time of year" onChange={setSeason} options={[["regular", "Regular season"], ["bowls", "From Dec 7"]] as const} value={season} />
            <Chips label="Picks" onChange={(value) => setAllIn(value === "in")} options={[["owed", "A pick owed"], ["in", "All in"]] as const} value={allIn ? "in" : "owed"} />
            <Chips label="Chat" onChange={(value) => setMail(value === "new")} options={[["new", "New message"], ["none", "Nothing new"]] as const} value={mail ? "new" : "none"} />
          </div>
          <ClubRoom allIn={allIn} mail={mail} onEnter={setRoom} season={season} />
        </>
      ) : (
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
      {room === "bowl" ? <StandIn>The Bowl Pool opens here.</StandIn> : null}
      {room === "record" ? <StandIn>The record book opens here: the pool’s stats, season by season.</StandIn> : null}
      {room === "constitution" ? <StandIn>The pool’s constitution opens here, posted in full.</StandIn> : null}
      {room === "race" ? <StandIn>The race runs here: tap to send the field back to the gate and watch the season to date.</StandIn> : null}
      {room === "window" ? null : <Ticket allIn={allIn} onOpen={() => setRoom("window")} />}
    </section>
  );
}
