"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Logo } from "@/components/clubhouse/lamps";
import { boardPages } from "@/lib/board-pages.js";
import ROOM_PICTURES from "@/lib/clubhouse-room.json";
import { haptic } from "@/lib/haptics-client";
import { toggleSiteTheme } from "@/lib/site-theme.js";

/**
 * The clubhouse room: one picture of a grand beach bungalow (by day, and at night with the pool lit), its two live boards (the Big Board
 * and the spreads), and a tap spot with a gilt name plate over each thing in it. The real clubhouse (/clubhouse) and the Lab both draw it.
 */

/** Where a spot in the room leads. */
export type Room = "board" | "trophies" | "survivor" | "bowl" | "chat" | "constitution" | "snapshot";

type Spot = { x: number; y: number; w: number; h: number };
type Point = number[];
type Picture = { width: number; height: number; spots: Record<string, Spot>; screens?: Record<string, Point[]> };
const PICTURES: Record<string, Picture> = ROOM_PICTURES;

/** Each thing in the picture that can be tapped: where it goes, the name on its plate, and where the plate sits. */
const SPOTS: ReadonlyArray<{ spot: string; room: Room; name: string; tag?: string; label: "above" | "below" | "none" | "free"; at?: { x: number; y: number }; wideAt?: { x: number; y: number }; fullAt?: { x: number; y: number }; ticket?: boolean; realOnly?: boolean }> = [
  // The poker table comes first: it is the biggest thing in the picture, so everything smaller stays on top of it.
  { spot: "survivor", room: "survivor", name: "Survivor", label: "below" },
  // The spreads under the Big Board are where picks are made: the board itself opens the Big Board with your ticket ready (it needs
  // no label: it looks like the ticket), and so does the "Your picks" button, which stands by itself in the gap between the chairs.
  { spot: "sportsbook", room: "board", name: "Make your picks", label: "none", ticket: true },
  { spot: "trophies", room: "trophies", name: "Trophy Room", tag: "Trophies", label: "above" },
  { spot: "board", room: "board", name: "The Big Board", label: "above" },
  // The chat plate stands on the bar stools just above the chalkboard (owner, 2026-11-22).
  { spot: "chat", room: "chat", name: "Pool chat", tag: "Chat", label: "free", at: { x: 0.82, y: 0.55 }, fullAt: { x: 0.82, y: 0.55 }, wideAt: { x: 0.76, y: 0.64 } },
  // The chalkboard on its stand between the table and the bar: the Season Snapshot, sketched in chalk (and from Dec 7 the Bowl Pool's).
  // A small "Snapshot" pill sits on the board's upper edge so it reads as tappable (owner, 2026-11-22); above your ticket on a phone.
  { spot: "chalkboard", room: "snapshot", name: "Season Snapshot", tag: "Snapshot", label: "free", at: { x: 0.78, y: 0.66 }, fullAt: { x: 0.8, y: 0.66 }, wideAt: { x: 0.83, y: 0.7 } },
  { spot: "constitution", room: "constitution", name: "Constitution", tag: "Rules", label: "below" },
  // Notifications: a plate like the others, up in the thatch at the right where it covers nothing (the real clubhouse only: it opens
  // the player's own settings).
  { spot: "notify", room: "board", name: "Notifications", tag: "Notifications", label: "free", at: { x: 0.8, y: 0.19 }, fullAt: { x: 0.8, y: 0.25 }, wideAt: { x: 0.8, y: 0.14 }, realOnly: true },
];

/** The room's lamps, by picture shape (tall, filling the phone, wide): tapping one turns the lights down for night, or up for day. */
const LAMPS: Record<"tall" | "full" | "wide", Array<{ name: string; x: number; y: number }>> = {
  tall: [{ name: "ceiling light", x: 0.53, y: 0.04 }],
  full: [{ name: "ceiling light", x: 0.53, y: 0.12 }],
  wide: [{ name: "ceiling light", x: 0.49, y: 0.15 }, { name: "bar lamp", x: 0.85, y: 0.56 }],
};

/** The site's day or night, as the header's switch sets it (read straight from the page, before the header has had a turn). */
function nightNow() {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "night";
  try { return window.localStorage.getItem("pickem-theme") === "night"; } catch { return false; }
}
function followTheme(change: () => void) {
  window.addEventListener("pickem-theme-change", change);
  const watch = new MutationObserver(change);
  watch.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => { window.removeEventListener("pickem-theme-change", change); watch.disconnect(); };
}
/** A desktop (900px and wider) gets the wide picture, known on the first render so a desktop never loads the phone's picture first. */
const WIDE_QUERY = "(min-width: 900px)";
const wideNow = () => window.matchMedia(WIDE_QUERY).matches;
function followWide(change: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/**
 * The real clubhouse's room picture for this screen, as RoomScene draws it: started as soon as the page opens, before the pool's data is
 * in, so the picture is already on its way when the room appears.
 */
export function warmRoomPicture() {
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = `/lab/clubhouse/room-${nightNow() ? "night" : "day"}${wideNow() ? "-wide" : "-full"}.webp`;
}

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
/** The Big Board in the room: the leader always on the top line, then up to five players a page, a new page every 8 seconds. */
const BOARD_PAGE = 5;
const BOARD_PAGE_MS = 8_000;
const TICKER_MS = 7_000;

/** One player's line on the Big Board. */
export type RoomStanding = { name: string; wins: number; place: number | null; tied: boolean; move?: number };
/** One game on the spreads board: its kickoff as shown, the two teams (abbreviations) and each one's line. */
export type RoomGame = { id: string; kickoff: string; at?: number; away: string; home: string; awayLine: string; homeLine: string; final?: { away: { score: number; covered: boolean }; home: { score: number; covered: boolean } }; bowl?: string; picked?: "away" | "home" | null };
/**
 * Everything the room shows by itself: the standings for the Big Board, the week's games for the spreads board, your own picks (lit
 * there), the line of news on a label, whether a pick is owed, a new chat message, and whether it is bowl season (from Dec 7: the Bowl Pool takes the poker table once Survivor is done, and the chalkboard turns between the two pools). The Lab
 * fills it with the sample league; the real clubhouse with the pool's own data, the same data the classic pages show.
 */
export type RoomFeed = { week: string; standings: RoomStanding[]; games: RoomGame[]; mine: string[]; news: Partial<Record<string, string>>; owed: boolean; mail: boolean; bowl: boolean; survivorOver?: boolean; survivorShown?: boolean; survivorActive?: boolean };

function RoomNews({ picture, frame, feed, night }: { picture: Picture; frame: { width: number; height: number } | null; feed: RoomFeed; night: boolean }) {
  const rows = feed.standings;
  const mine = feed.mine;
  // The top line always shows the leader and their wins (or, when level, how many lead and on what), so every page has a sense of
  // scale. Below it the rest of the standings turn a page every 8 seconds, the pages kept even (nine players are three pages of
  // three); a single leader is not repeated below, level leaders are. The lines run across the spreads board like a ticker (shown
  // twice in a row so the loop has no seam).
  const { leaders, pages: board } = boardPages(rows, BOARD_PAGE);
  const pages = Math.max(1, board.length);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setPage((at) => (at + 1) % pages), BOARD_PAGE_MS);
    return () => window.clearInterval(timer);
  }, [pages]);
  const standings = board[page % pages] ?? [];
  const games = feed.games;
  // The games stand two wide, so two whole games are always up. Every 7 seconds the board shifts up one row, like a slot machine or the
  // ticker along the bottom of ESPN; the first row is repeated at the foot so the last shift runs on into the first with no jump.
  const rowCount = Math.ceil(games.length / 2);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (rowCount < 2) return;
    const timer = window.setInterval(() => setStep((at) => (at >= rowCount ? 1 : at + 1)), TICKER_MS);
    return () => window.clearInterval(timer);
  }, [rowCount]);
  // One row only (two games or fewer) stands still; none at all leaves the board dark.
  const gameRows = rowCount === 0 ? [] : Array.from({ length: rowCount < 2 ? 1 : rowCount + 1 }, (_, row) => (games.length === 1 ? [games[0]] : [0, 1].map((side) => games[(2 * (row % rowCount) + side) % games.length])));
  return (
    <div aria-hidden="true" className="lab-room-live">
      <Screen box={frame} className={`is-chalk${night ? " is-night" : ""}`} corners={picture.screens?.chalkboard} h={152} w={240}><ChalkSketch /></Screen>
      <Screen box={frame} className="is-board" corners={picture.screens?.board} h={206} w={288}>
        <header><b>PICK’EM</b><span>{feed.week.toUpperCase()} · {page + 1}/{pages}</span></header>
        {leaders.length ? <p className="lab-room-leader"><i>LEAD</i><span>{leaders.length === 1 ? leaders[0].name : `${leaders.length}-WAY TIE`}</span><b>{leaders[0].wins}</b></p> : null}
        <div className="lab-roll">
          <ol data-page={page + 1}>
            {standings.map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <i>{row.tied ? "T" : ""}{row.place}</i><span>{row.name}</span>{row.move ? <em className={row.move > 0 ? "is-up" : "is-down"}>{row.move > 0 ? "▲" : "▼"}{Math.abs(row.move)}</em> : <em />}<b>{row.wins}</b>
              </li>
            ))}
          </ol>
        </div>
      </Screen>
      <Screen box={frame} className={`is-spreads${feed.owed ? " is-owed" : ""}`} corners={picture.screens?.spreads} h={103} w={360}>
        <div className="lab-ticker-view">
          <div className={`lab-ticker${step === 0 ? " is-snap" : ""}`} onTransitionEnd={() => setStep((at) => (at >= rowCount ? 0 : at))} style={{ ["--rows" as string]: rowCount + 1, ["--step" as string]: step }}>
            {gameRows.map((row, index) => (
              <div key={index}>
                {row.map((game) => {
                  // One matchup, one card, the way a sportsbook board lists them: the kickoff, then the away team over the home team, each
                  // with its logo and line; your pick is lit in gold inside the card.
                  // A game that is over shows each side's final score instead of its line, the side that covered lit, and says FINAL.
                  // The spread stays on the card once the game is over, small beside the score: it is what the score was measured against. The logo
                  // gives way to make room for it (team, spread and score do not fit beside a logo in half a screen).
                  // A bowl in bowl season reads the same way, by the schools' short names (no NFL logo), its bowl's short name in the corner, and
                  // your own bowl pick lit.
                  const side = (where: "away" | "home") => {
                    const team = game[where];
                    const done = game.final?.[where];
                    const line = where === "away" ? game.awayLine : game.homeLine;
                    const picked = game.bowl ? game.picked === where : mine.includes(team);
                    return <span className={`${picked ? "is-picked" : ""}${done?.covered ? " is-covered" : ""}${done ? " is-final" : ""}`}>{done || game.bowl ? null : <Logo eager team={team} />}<b>{team}</b>{done ? <i>{line}</i> : null}<em>{done ? done.score : line}</em></span>;
                  };
                  const when = game.final ? `FINAL · ${game.kickoff.split(" ")[0].toUpperCase()}` : game.kickoff.toUpperCase();
                  return <p className={game.bowl ? "is-bowl" : undefined} key={`${game.id}-${index}`}><small>{game.bowl ? `${game.bowl} · ${when}` : when}</small>{side("away")}{side("home")}</p>;
                })}
              </div>
            ))}
          </div>
        </div>
      </Screen>
    </div>
  );
}

/**
 * The chalkboard's slate: a still chalk drawing of a standings race, the way someone would sketch one by hand (no names, no numbers),
 * with old chalk dust where earlier races were wiped away. It is the same drawing all season; tapping the board opens the real chart.
 * The picture's own light is on it, so at night the chalk is a little dimmer.
 */
function ChalkSketch() {
  const lines: Array<[string, string]> = [
    ["#f4f1e8", "M22 128 C40 112 56 104 72 92 S100 70 118 62 S150 44 170 34 S204 18 222 14"],
    ["#f3d97a", "M22 128 C42 120 58 110 76 104 S104 92 122 80 S152 74 172 62 S204 48 222 44"],
    ["#9fd3f2", "M22 128 C44 124 60 118 80 114 S106 104 126 100 S154 94 174 86 S204 78 222 74"],
    ["#f2a3c4", "M22 128 C46 127 64 124 84 122 S112 118 130 116 S158 112 178 110 S206 106 222 104"],
  ];
  return (
    <svg viewBox="0 0 240 152">
      <defs>
        <filter id="chalk-grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence baseFrequency="0.9" numOctaves="2" result="noise" seed="7" type="fractalNoise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" result="rough" scale="2.2" />
          <feColorMatrix in="noise" result="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.3" />
          <feComposite in="rough" in2="grain" operator="in" />
        </filter>
        <filter id="chalk-dust"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      {/* old races wiped with a felt */}
      <g className="chalk-dust" filter="url(#chalk-dust)">
        <ellipse cx="70" cy="60" rx="52" ry="18" />
        <ellipse cx="170" cy="112" rx="58" ry="16" />
      </g>
      <g filter="url(#chalk-grain)">
        <path className="chalk-axis" d="M16 14 L17 134 L228 133" />
        {[40, 72, 104].map((y) => <path className="chalk-tick" d={`M13 ${y} L21 ${y + 1}`} key={y} />)}
        {[62, 108, 154, 200].map((x) => <path className="chalk-tick" d={`M${x} 130 L${x + 1} 138`} key={x} />)}
        {lines.map(([color, d]) => <path className="chalk-line" d={d} key={color} style={{ stroke: color }} />)}
      </g>
    </svg>
  );
}

/**
 * The room itself: the picture by day and at night, the two live boards, and a tap spot over each thing in it with its name plate.
 * In the Lab a tap opens one of the Lab's rooms (`onSpot`); in the real clubhouse every spot is a link to the real page (`hrefFor`).
 * `full` lets the picture fill the screen under the site's bar (the real clubhouse); the Lab shows it as a framed picture.
 */
export function RoomScene({ feed, onSpot, hrefFor, full = false }: { feed: RoomFeed; onSpot?: (spot: string, room: Room, ticket?: boolean) => void; hrefFor?: (spot: string) => string | null; full?: boolean }) {
  // Whether the lights are down, followed from the site's theme, so a lamp's label says what tapping it does.
  // Read where it is drawn, so the first render already knows (the picture it loads first is the one on screen).
  const night = useSyncExternalStore(followTheme, nightNow, () => false);
  // A phone gets the tall picture; a desktop (900px and wider) gets the wide one: the same room through a longer lens, everything in
  // one view, with its own positions for every label.
  const wide = useSyncExternalStore(followWide, wideNow, () => false);
  // Only the picture on screen loads at once; the other (day or night) follows once the room has settled, so the lamp switch is still
  // instant but the first load carries one picture, not two.
  const [settled, setSettled] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSettled(true), 2500); return () => window.clearTimeout(timer); }, []);
  // The real clubhouse on a phone has its own taller picture, to fill the screen.
  const key = wide ? "-wide" : full ? "-full" : "";
  const picture = PICTURES[`day${key}`] ?? PICTURES.day;
  const news = feed.news;
  // The poker table is whichever pool is being played: Survivor while it runs, the Bowl Pool in bowl season (in the Bowl Pool's navy and
  // gold), never both; between the two (Survivor decided, the Bowl Pool not open yet) it has no plate. (Both are always on the board's tabs.)
  const survivorActive = feed.survivorActive ?? !feed.survivorOver;
  const table: "survivor" | "bowl" | null = survivorActive ? "survivor" : feed.bowl ? "bowl" : null;
  const taken = table === "bowl";
  const spots = SPOTS.flatMap((item) => {
    if (item.spot === "survivor") return table === null ? [] : taken ? [{ ...item, room: "bowl" as Room, name: "Bowl Pool" }] : [item];
    return [item];
  }).filter(({ spot, at, realOnly }) => (at || picture.spots[spot]) && !(realOnly && !hrefFor) && (!hrefFor || hrefFor(spot) !== null));
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
  const scene = (
    <nav aria-label="Clubhouse rooms" className={`lab-room${wide ? " is-wide" : ""}${full ? " is-full" : ""}`} ref={room} style={{ aspectRatio: `${picture.width} / ${picture.height}`, ["--room-aspect" as string]: picture.width / picture.height }}>
      {!night || settled ? <Image alt="The clubhouse: a bright lounge with glass doors onto a pool patio" className="lab-room-picture is-day" fetchPriority={night ? "low" : "high"} height={picture.height * 2} loading="eager" priority={!night} src={`/lab/clubhouse/room-day${key}.webp`} unoptimized width={picture.width * 2} /> : null}
      {night || settled ? <Image alt="The clubhouse at night, the pool lit outside" className="lab-room-picture is-night" fetchPriority={night ? "high" : "low"} height={picture.height * 2} loading="eager" priority={night} src={`/lab/clubhouse/room-night${key}.webp`} unoptimized width={picture.width * 2} /> : null}
      <RoomNews feed={feed} frame={frame} night={night} picture={picture} />
      {spots.map(({ spot, room: next, name, tag, label, at: tall, wideAt, fullAt, ticket }) => {
        const free = wide ? wideAt ?? tall : full ? fullAt ?? tall : tall;
        // Filling the screen crops the picture a little at its sides; a plate that would be cut off there is drawn in from the edge: the
        // chimney's (Trophies, Rules) at the left, the bar's chat plate at the right. (The chat plate's red new-message flag hangs off its
        // left end, into the room, so it never needs room at the edge.)
        // The chalkboard stands in front of the games counter: the counter's spot stops at the board's top, so a tap on the board
        // always opens the Season Snapshot and a tap on the counter above it your ticket.
        const chalk = picture.spots.chalkboard;
        const at = spot === "sportsbook" && chalk && picture.spots[spot].y + picture.spots[spot].h > chalk.y ? { ...picture.spots[spot], h: chalk.y - picture.spots[spot].y } : picture.spots[spot];
        let plateStyle: CSSProperties | undefined;
        if (full && frame && at && typeof window !== "undefined") {
          const crop = Math.max(0, (frame.width - document.documentElement.clientWidth) / 2) + 6;
          if (spot === "trophies" || spot === "constitution") plateStyle = { left: Math.max(0, crop - at.x * frame.width) };
        }
        const plate = label === "none" ? null : (
          <span className={`lab-room-tag is-${label}${taken && spot === "survivor" ? " is-bowl-pool" : ""}${news[spot] ? " has-news" : ""}${spot === "chat" && feed.mail ? " has-mail" : ""}`} style={plateStyle}>
            <b aria-hidden="true">{tag ?? name}<i /></b>{news[spot] ? <small aria-hidden="true">{news[spot]}</small> : null}
            {spot === "chat" && feed.mail ? <span aria-label="New message" className="lab-room-mail" role="img">✉</span> : null}
          </span>
        );
        const href = hrefFor?.(spot) ?? null;
        // A button that stands by itself in the picture, not over a thing in it; or placed by its corner over the thing, with no
        // transform (a transform would trap each label under the spots drawn after it).
        const className = free ? `lab-room-bubble is-${spot}` : `lab-room-spot is-${spot}${spot === "sportsbook" && feed.owed ? " is-owed" : ""}`;
        const style = (free ? { left: `${free.x * 100}%`, top: `${free.y * 100}%` } : { left: `${at.x * 100}%`, top: `${at.y * 100}%`, width: `${at.w * 100}%`, height: `${at.h * 100}%` }) as CSSProperties;
        // A "#name" is not a page: it is a button that asks the screen to open that thing over the room (the chat).
        if (href && !href.startsWith("#")) return <Link aria-label={name} className={className} href={href} key={spot} style={style}>{plate}</Link>;
        return <button aria-label={name} className={className} key={spot} onClick={() => onSpot?.(spot, next, ticket)} style={style} type="button">{plate}</button>;
      })}
      {/* The lamps (the real clubhouse): tap one and the lights go down for night, or up for day, the same switch as the header's. */}
      {hrefFor ? LAMPS[wide ? "wide" : full ? "full" : "tall"].map((lamp) => (
        <button aria-label={`Turn the lights ${night ? "up (day)" : "down (night)"}: the ${lamp.name}`} className="lab-room-lamp" key={lamp.name} onClick={() => { haptic("tick"); toggleSiteTheme(); }} style={{ left: `${lamp.x * 100}%`, top: `${lamp.y * 100}%` }} type="button" />
      )) : null}
    </nav>
  );
  return full ? <RoomStage>{scene}</RoomStage> : scene;
}

/**
 * The screen the room fills: from just under everything above it (the site's bar, and on a phone the account strip over it) to the
 * bottom of the screen, measured where it actually starts, so the whole room is in view without scrolling.
 */
function RoomStage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => node.style.setProperty("--stage-top", `${Math.max(0, node.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(document.body);
    window.addEventListener("resize", measure);
    return () => { watch.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div className="lab-room-stage" ref={stage}>{children}</div>;
}
