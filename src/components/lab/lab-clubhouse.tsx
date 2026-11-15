"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import TrophyTurntable from "@/components/trophy-turntable";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { BigBoardRoom } from "@/components/lab/lab-tote";
import { LAB_VIEWER, labBoardPages, labLeaderboard, labStandard } from "@/lib/lab-clubhouse.js";
import { LAB_RECORDS, LAB_SLATE, labLineFor, labSurvivorAt } from "@/lib/lab-samples.js";
import ROOM_PICTURES from "@/lib/lab-clubhouse-room.json";

/**
 * Lab try-out: the whole pool as one clubhouse, with the sample league only. Built for a phone first.
 *  - The room: a grand beach bungalow drawn in 3D and shown as one picture (by day, and at night with the pool lit), seen from just
 *    inside, looking down the room under a thatched beach-hut ceiling with two big palm-leaf fans. There is room to walk: in past
 *    the poker table, along the bar, round the lounge and out through the open doors. Tap anything to go there: the wall that faces
 *    you where picks are made (the Big Board, under it one wide board of the week's spreads, the counter; no sign says
 *    "sportsbook"), the bar down the left wall (the plaques along its front, the laptop on top: the pool chat, a
 *    mail sign when there's a new message), the stone chimney on the right (the fire lit at night, a Trophy Room sign on it above the
 *    framed constitution) (it opens today's turning table and banners), the lounge by the fire (the record book open on
 *    its table), the oval Survivor poker table forward in the middle with a chair for every player, and from Dec 7 the Bowl Pool's
 *    bulletin board, wheeled in at the front left.
 *  - Everything that can be tapped says so: a gilt name plate with an arrow sits on each thing, always, and the three with news worth
 *    a glance (the Big Board, Survivor, the Bowl Pool) carry a line of it. A plain list of the rooms sits under the picture for anyone
 *    who would rather tap a word.
 *  - Picks are made on the Big Board: your own row there is your ticket. Your ticket is also pinned at the bottom of every screen (a
 *    lamp for each pick, lit once it is in, and the next deadline) and opens the Big Board with the ticket ready. The picks wall glows
 *    while a pick is still owed.
 *  - One tap opens a room; one "Back to Clubhouse" button at the top of every room goes back. No swiping.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

type Room = "board" | "trophies" | "survivor" | "bowl" | "chat" | "constitution";
const ROOM_TITLE: Record<Room, string> = {
  board: "The Big Board", trophies: "Trophy Room", survivor: "Survivor", bowl: "Bowl Pool", chat: "Pool chat", constitution: "Constitution",
};

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="lab-chips" role="group">
      {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
    </div>
  );
}

/* ---------------------------------------------------------------- Trophy Room and plaques ---------------------------------------------------------------- */

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

/**
 * The Trophy Room: today's page as it is (the trophies on their turning table, the banners of the one at the front, the records),
 * with the season plaques added under the banners. Plaques and records used to be spots in the room; they live here now.
 */
function TrophyRoom() {
  return (
    <div className="lab-room-stack lab-wall-table">
      <TrophyTurntable seasons={SAMPLE_SEASONS} />
      <PlaquesShelf />
      <RecordsTable />
    </div>
  );
}

/** The all-time Pick'em records, best hit rate first: place, player, wins, losses and the rate they make. */
function RecordsTable() {
  return (
    <section aria-label="Records" className="lab-records">
      <h4>Records <small>all-time Pick’em</small></h4>
      <table>
        <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Rate</th></tr></thead>
        <tbody>
          {LAB_RECORDS.map((row, index) => (
            <tr key={row.name}><td>{index + 1}</td><th scope="row">{row.name}</th><td>{row.wins}</td><td>{row.losses}</td><td>{row.rate.toFixed(3).slice(1)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** The plaques, one for every season, and the pennant a new champion is given. */
function PlaquesShelf() {
  const [scene, setScene] = useState<"plaques" | "crowning">("plaques");
  const [crownings, setCrownings] = useState(0);
  return (
    <div className="lab-room-stack">
      <div className="lab-room-controls">
        <Chips label="Scene" onChange={(next) => { setScene(next); if (next === "crowning") setCrownings((count) => count + 1); }} options={[["plaques", "The plaques"], ["crowning", "A champion is crowned"]] as const} value={scene} />
      </div>
      <div className="lab-case lab-wall">
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
type Point = number[];
type Picture = { width: number; height: number; spots: Record<string, Spot>; screens?: Record<string, Point[]> };
const PICTURES: Record<string, Picture> = ROOM_PICTURES;

/** Each thing in the picture that can be tapped: where it goes, the name on its plate, and where the plate sits. */
const SPOTS: ReadonlyArray<{ spot: string; room: Room; name: string; tag?: string; label: "above" | "below"; ticket?: boolean }> = [
  // The poker table comes first: it is the biggest thing in the picture, so everything smaller stays on top of it.
  { spot: "survivor", room: "survivor", name: "Survivor", label: "below" },
  // The spreads under the Big Board are where picks are made: they open the Big Board with your ticket ready.
  { spot: "sportsbook", room: "board", name: "Make your picks", tag: "Your picks", label: "below", ticket: true },
  { spot: "trophies", room: "trophies", name: "Trophy Room", tag: "Trophies", label: "above" },
  { spot: "board", room: "board", name: "The Big Board", label: "above" },
  { spot: "bowl", room: "bowl", name: "Bowl Pool", label: "below" },
  { spot: "chat", room: "chat", name: "Pool chat", tag: "Chat", label: "below" },
  { spot: "constitution", room: "constitution", name: "Constitution", tag: "Rules", label: "below" },
];

type Season = "regular" | "bowls";

/**
 * The CSS transform that lays a w by h box exactly over a four-cornered patch of the picture (top left, top right, bottom right, bottom
 * left, in pixels): the boards in the picture are seen in perspective, so what is drawn on them has to be too.
 */
function onto(w: number, h: number, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Point[]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3, det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det, k = (dx1 * sy - sx * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(",")})`;
}

/** A face drawn on one of the room's screens, sized in its own pixels and laid over the screen's corners in the picture. */
function Screen({ corners, box, w, h, className, children }: { corners: Point[] | undefined; box: { width: number; height: number } | null; w: number; h: number; className: string; children: ReactNode }) {
  if (!corners || !box) return null;
  const transform = onto(w, h, corners.map(([x, y]) => [x * box.width, y * box.height] as Point));
  return <div className={`lab-room-screen ${className}`} style={{ height: h, transform, width: w }}>{children}</div>;
}

/**
 * Today's news in the room itself, the way it would be in a real clubhouse: the Big Board shows the standings (the top five, and you
 * if you are further down) and the spreads board shows this week's lines with your own picks lit. Nobody else's unstarted pick is
 * ever shown. The headline of each (and Survivor's) is also in its label, in type big enough to read at a glance.
 */
/** The Big Board in the room: the leader always on the top line, then up to five players a page, a new page every 15 seconds. */
const BOARD_PAGE = 5;
const BOARD_PAGE_MS = 15_000;

function RoomNews({ picture, frame }: { picture: Picture; frame: { width: number; height: number } | null }) {
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const mine = labStandard(LAB_VIEWER, { round: "regular", moment: "before" }).slats.map((slat) => slat.team);
  // The top line always shows the leader and their wins (or, when level, how many lead and on what), so every page has a sense of
  // scale. Below it the rest of the standings turn a page every 15 seconds, the pages kept even (nine players are three pages of
  // three); a single leader is not repeated below, level leaders are. The lines run across the spreads board like a ticker (shown
  // twice in a row so the loop has no seam).
  const { leaders, pages: board } = labBoardPages(rows, BOARD_PAGE);
  const pages = board.length;
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setPage((at) => (at + 1) % pages), BOARD_PAGE_MS);
    return () => window.clearInterval(timer);
  }, [pages]);
  const standings = board[page % pages];
  const lines = [...LAB_SLATE, ...LAB_SLATE];
  return (
    <div aria-hidden="true" className="lab-room-live">
      <Screen box={frame} className="is-board" corners={picture.screens?.board} h={206} w={288}>
        <header><b>PICK’EM</b><span>WEEK 10 · {page + 1}/{pages}</span></header>
        <p className="lab-room-leader">{leaders.length === 1 ? <><i>LEADER</i><span>{leaders[0].name}</span></> : <><i>{leaders.length} LEADERS</i><span /></>}<b>{leaders[0].wins}</b></p>
        <div className="lab-roll">
          <ol data-page={page + 1}>
            {standings.map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <i>{row.tied ? "T" : ""}{row.place}</i><span>{row.name}</span><b>{row.wins}</b>
              </li>
            ))}
          </ol>
        </div>
      </Screen>
      <Screen box={frame} className="is-spreads" corners={picture.screens?.spreads} h={103} w={360}>
        <div className="lab-ticker">
          {lines.map((game, index) => {
            const pick = mine.find((team) => team === game.away || team === game.home);
            const team = pick ?? game.favourite;
            return <p className={pick ? "is-picked" : ""} key={`${game.id}-${index}`}><b>{team}</b><span>{labLineFor(game, team)}</span>{pick ? <small>YOURS</small> : null}</p>;
          })}
        </div>
      </Screen>
    </div>
  );
}

/** Your ticket, pinned at the bottom of every screen: a lamp for each pick, the next deadline; it opens the Big Board with the ticket ready. */
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
function ClubRoom({ season, allIn, mail, onEnter }: { season: Season; allIn: boolean; mail: boolean; onEnter: (room: Room, ticket?: boolean) => void }) {
  const key = season === "bowls" ? "-bowl" : "";
  const picture = PICTURES[`day${key}`];
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const you = rows.find((row) => row.name === LAB_VIEWER);
  const seats = labSurvivorAt(9);
  const news: Partial<Record<string, string>> = {
    board: `${rows[0].name} leads · You: ${you?.tied ? "T" : ""}${you?.place ?? ""}`,
    sportsbook: allIn ? "All in" : "1 owed",
    survivor: `${seats.filter((seat) => !seat.out).length} of ${seats.length} still in · ${seats.find((seat) => seat.name === LAB_VIEWER)?.out ? "You’re out" : "You’re in"}`,
    bowl: "Open now",
  };
  const spots = SPOTS.filter(({ spot }) => picture.spots[spot]);
  const room = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const node = room.current;
    if (!node) return;
    const measure = () => setFrame({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  // The chat is on the laptop on the bar: tapping it walks you up to the screen (the picture zooms in on the laptop) and then the
  // chat opens. With reduced motion on it just opens.
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const go = (spot: string, next: Room, ticket?: boolean) => {
    const at = picture.spots[spot];
    if (spot !== "chat" || !at || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onEnter(next, ticket); return; }
    setZoom({ x: at.x + at.w / 2, y: at.y + at.h / 2 });
  };
  return (
    <>
      <nav aria-label="Clubhouse rooms" className="lab-room" ref={room} style={{ aspectRatio: `${picture.width} / ${picture.height}` }}>
        <div className={`lab-room-view${zoom ? " is-zooming" : ""}`} onTransitionEnd={(event) => { if (zoom && event.target === event.currentTarget) onEnter("chat"); }} style={zoom ? { transformOrigin: `${zoom.x * 100}% ${zoom.y * 100}%` } : undefined}>
        <Image alt="The clubhouse: a bright lounge with glass doors onto a pool patio" className="lab-room-picture is-day" height={picture.height * 2} priority src={`/lab/clubhouse/room-day${key}.webp`} unoptimized width={picture.width * 2} />
        <Image alt="The clubhouse at night, the pool lit outside" className="lab-room-picture is-night" height={picture.height * 2} priority src={`/lab/clubhouse/room-night${key}.webp`} unoptimized width={picture.width * 2} />
        <RoomNews frame={frame} picture={picture} />
        {spots.map(({ spot, room, name, tag, label, ticket }) => {
          const at = picture.spots[spot];
          // Placed by its corner, with no transform: a transform would trap each label under the spots drawn after it.
          const style = { left: `${at.x * 100}%`, top: `${at.y * 100}%`, width: `${at.w * 100}%`, height: `${at.h * 100}%` } as CSSProperties;
          return (
            <button aria-label={name} className={`lab-room-spot is-${spot}${spot === "sportsbook" && !allIn ? " is-owed" : ""}`} key={spot} onClick={() => go(spot, room, ticket)} style={style} type="button">
              <span className={`lab-room-tag is-${label}${news[spot] ? " has-news" : ""}`}>
                <b aria-hidden="true">{tag ?? name}<i>›</i></b>{news[spot] ? <small aria-hidden="true">{news[spot]}</small> : null}
                {spot === "chat" && mail ? <span aria-label="New message" className="lab-room-mail" role="img">✉</span> : null}
              </span>
            </button>
          );
        })}
        </div>
      </nav>
      <div aria-label="Rooms" className="lab-room-list" role="group">
        {(["board", "survivor", "trophies", "constitution", "chat", ...(season === "bowls" ? ["bowl"] : [])] as Room[]).map((room) => (
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
  // Coming in by the picks wall or the pinned ticket opens the Big Board with the ticket ready; each arrival is a fresh one.
  const [ticketOpen, setTicketOpen] = useState(false);
  const [visit, setVisit] = useState(0);
  const enter = (next: Room, ticket = false) => { setRoom(next); setTicketOpen(ticket); setVisit((count) => count + 1); };
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
          <ClubRoom allIn={allIn} mail={mail} onEnter={enter} season={season} />
        </>
      ) : (
        <header className="lab-room-bar">
          <button className="lab-room-back" onClick={() => setRoom(null)} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{ROOM_TITLE[room]}</h3>
        </header>
      )}
      {room === "board" ? <BigBoardRoom key={visit} onTicket={setAllIn} startOpen={ticketOpen} survivorIn={allIn} /> : null}
      {room === "trophies" ? <TrophyRoom /> : null}
      {room === "survivor" ? <LabSurvivorTable /> : null}
      {room === "chat" ? <StandIn>The pool chat opens here, exactly as it works today.</StandIn> : null}
      {room === "bowl" ? <StandIn>The Bowl Pool opens here.</StandIn> : null}
      {room === "constitution" ? <StandIn>The pool’s constitution opens here, posted in full.</StandIn> : null}
      <Ticket allIn={allIn} onOpen={() => enter("board", true)} />
    </section>
  );
}
