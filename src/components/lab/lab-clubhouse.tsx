"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import AllTimeTable, { type AllTimeRow } from "@/components/all-time-table";
import TrophyTurntable from "@/components/trophy-turntable";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { RoomTicket } from "@/components/room-ticket";
import { BigBoardRoom, Logo } from "@/components/lab/lab-tote";
import { POOL_CONSTITUTION } from "@/components/commissioner-handbook";
import { LAB_VIEWER, labBoardPages, labKickedOff, labLeaderboard, labStandard } from "@/lib/lab-clubhouse.js";
import { LAB_RECORDS, LAB_SLATE, labAtsResult, labLineFor, labSurvivorAt } from "@/lib/lab-samples.js";
import ROOM_PICTURES from "@/lib/lab-clubhouse-room.json";
import { haptic } from "@/lib/haptics-client";
import { toggleSiteTheme } from "@/lib/site-theme.js";

/**
 * Lab try-out: the whole pool as one clubhouse, with the sample league only. Built for a phone first.
 *  - The room: a grand beach bungalow drawn in 3D and shown as one picture (by day, and at night with the pool lit), seen from just
 *    inside, looking down the room under a thatched beach-hut ceiling with two big palm-leaf fans. There is room to walk: in past
 *    the poker table, along the bar, round the lounge and out through the open doors. Tap anything to go there: the wall that faces
 *    you where picks are made (the Big Board, under it one wide board of the week's spreads, the counter; no sign says
 *    "sportsbook"), the bar down the right wall (the plaques along its front, the laptop on top: the pool chat, a
 *    mail sign when there's a new message), the stone chimney on the left (the fire lit at night, a Trophy Room sign on it above the
 *    framed constitution) (it opens today's turning table and banners), the lounge by the fire (the record book open on
 *    its table), the oval Survivor poker table forward in the middle with a chair for every player, and from Dec 7 the Bowl Pool's
 *    bulletin board, wheeled in at the front right.
 *  - Everything that can be tapped says so: a gilt name plate with an arrow sits on each thing, always, and the three with news worth
 *    a glance (the Big Board, Survivor, the Bowl Pool) carry a line of it. A plain list of the rooms sits under the picture for anyone
 *    who would rather tap a word.
 *  - Picks are made on the Big Board: your own row there is your ticket. Your ticket is also pinned at the bottom of every screen (a
 *    lamp for each pick, lit once it is in, and the next deadline) and opens the Big Board with the ticket ready. The picks wall glows
 *    while a pick is still owed.
 *  - One tap opens a room; one "Back to Clubhouse" button at the top of every room goes back. No swiping.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

export type Room = "board" | "trophies" | "survivor" | "bowl" | "chat" | "constitution";
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
type Champions = { season: string } & Record<Pool, string>;
const CHAMPIONS: Champions[] = [
  { season: "2026", pickem: "Earl", survivor: "Rosie", bowl: "Walt" },
  { season: "2025", pickem: "Walt", survivor: "Dottie", bowl: "Rosie" },
  { season: "2024", pickem: "Earl", survivor: "Walt", bowl: "June" },
  { season: "2023", pickem: "Walt", survivor: "Lou", bowl: "Earl" },
];

/**
 * A season's plaque, kept quiet: satin brass with indented corners on walnut, one engraved keyline, the year over a diamond
 * rule, and each champion at the end of a dotted leader.
 */
function Plaque({ year }: { year: Champions }) {
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

type RealSeason = { seasonYear: number; pickem: Array<{ name: string }> | null; survivor: Array<{ name: string }> | null; bowl: Array<{ name: string }> | null };
type RealPlayer = AllTimeRow;
const names = (list: Array<{ name: string }> | null) => (list?.length ? list.map((champion) => champion.name).join(" & ") : "—");

/**
 * The Trophy Room on the pool's real champions and records (the Trophy Room page's own read): the trophies on their turning table, a plaque
 * for every season that has a champion (side by side, up to three a row), and the All-Time Table with its Record / Other Stats switch.
 */
export function RealTrophyRoom({ trophies, players }: { trophies: RealSeason[]; players: RealPlayer[] }) {
  const seasons = [...trophies].sort((a, b) => b.seasonYear - a.seasonYear).map((year) => ({ season: String(year.seasonYear), pickem: names(year.pickem), survivor: names(year.survivor), bowl: names(year.bowl) }));
  return (
    <div className="lab-room-stack lab-wall-table">
      <TrophyTurntable seasons={trophies} />
      <PlaquesShelf seasons={seasons} scenes={false} />
      <AllTimeTable heading="Records" players={players} />
    </div>
  );
}

/** The all-time Pick'em records, best hit rate first: place, player, wins, losses and the rate they make. */
function RecordsTable({ rows = LAB_RECORDS }: { rows?: Array<{ name: string; wins: number; losses: number; rate: number }> }) {
  return (
    <section aria-label="Records" className="lab-records">
      <h4>Records <small>all-time Pick’em</small></h4>
      <table>
        <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Rate</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.name}><td>{index + 1}</td><th scope="row">{row.name}</th><td>{row.wins}</td><td>{row.losses}</td><td>{row.rate.toFixed(3).slice(1)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** The plaques, one for every season, and the pennant a new champion is given. */
function PlaquesShelf({ seasons = CHAMPIONS, scenes = true }: { seasons?: Champions[]; scenes?: boolean }) {
  const [scene, setScene] = useState<"plaques" | "crowning">("plaques");
  const [crownings, setCrownings] = useState(0);
  return (
    <div className="lab-room-stack">
      {scenes ? <div className="lab-room-controls">
        <Chips label="Scene" onChange={(next) => { setScene(next); if (next === "crowning") setCrownings((count) => count + 1); }} options={[["plaques", "The plaques"], ["crowning", "A champion is crowned"]] as const} value={scene} />
      </div> : null}
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
            {seasons.length ? seasons.map((year) => <Plaque key={year.season} year={year} />) : <p className="lab-wall-empty">No champions yet.</p>}
          </div>
        </section>
        {scenes ? <div className="lab-case-countdown"><span>THE 2027 SEASON OPENS AUG 1</span><strong>172 DAYS</strong><small>sample date: Feb 10</small></div> : null}
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
const SPOTS: ReadonlyArray<{ spot: string; room: Room; name: string; tag?: string; label: "above" | "below" | "none" | "free"; at?: { x: number; y: number }; wideAt?: { x: number; y: number }; fullAt?: { x: number; y: number }; ticket?: boolean; realOnly?: boolean }> = [
  // The poker table comes first: it is the biggest thing in the picture, so everything smaller stays on top of it.
  { spot: "survivor", room: "survivor", name: "Survivor", label: "below" },
  // The spreads under the Big Board are where picks are made: the board itself opens the Big Board with your ticket ready (it needs
  // no label: it looks like the ticket), and so does the "Your picks" button, which stands by itself in the gap between the chairs.
  { spot: "sportsbook", room: "board", name: "Make your picks", label: "none", ticket: true },
  { spot: "trophies", room: "trophies", name: "Trophy Room", tag: "Trophies", label: "above" },
  { spot: "board", room: "board", name: "The Big Board", label: "above" },
  { spot: "bowl", room: "bowl", name: "Bowl Pool", label: "below" },
  { spot: "chat", room: "chat", name: "Pool chat", tag: "Chat", label: "below" },
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
export function warmRoomPicture(bowlSeason: boolean) {
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = `/lab/clubhouse/room-${nightNow() ? "night" : "day"}${bowlSeason ? "-bowl" : ""}${wideNow() ? "-wide" : "-full"}.webp`;
}

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
 * there), the line of news on a label, whether a pick is owed, a new chat message, and whether the Bowl Pool is wheeled in (its bulletin board, from Dec 7). The Lab
 * fills it with the sample league; the real clubhouse with the pool's own data, the same data the classic pages show.
 */
export type RoomFeed = { week: string; standings: RoomStanding[]; games: RoomGame[]; mine: string[]; news: Partial<Record<string, string>>; owed: boolean; mail: boolean; bowl: boolean; survivorOver?: boolean; survivorShown?: boolean; survivorActive?: boolean };

function RoomNews({ picture, frame, feed }: { picture: Picture; frame: { width: number; height: number } | null; feed: RoomFeed }) {
  const rows = feed.standings;
  const mine = feed.mine;
  // The top line always shows the leader and their wins (or, when level, how many lead and on what), so every page has a sense of
  // scale. Below it the rest of the standings turn a page every 8 seconds, the pages kept even (nine players are three pages of
  // three); a single leader is not repeated below, level leaders are. The lines run across the spreads board like a ticker (shown
  // twice in a row so the loop has no seam).
  const { leaders, pages: board } = labBoardPages(rows, BOARD_PAGE);
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

/** The sample league's feed for the Lab's room. */
function labFeed(season: Season, allIn: boolean, mail: boolean): RoomFeed {
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const you = rows.find((row) => row.name === LAB_VIEWER);
  const seats = labSurvivorAt(9);
  return {
    week: "Week 10",
    standings: rows,
    games: LAB_SLATE.map((game) => {
      const done = (team: string) => ({ score: (game.final as unknown as Record<string, number>)[team], covered: labAtsResult(game, team) === "W" });
      return { id: game.id, kickoff: game.kickoff, away: game.away, home: game.home, awayLine: labLineFor(game, game.away), homeLine: labLineFor(game, game.home), ...(labKickedOff(LAB_SLATE, game.id, "gameday") ? { final: { away: done(game.away), home: done(game.home) } } : {}) };
    }),
    mine: labStandard(LAB_VIEWER, { round: "regular", moment: "before" }).slats.map((slat) => slat.team),
    news: {
      board: `${rows[0].name} leads · You: ${you?.tied ? "T" : ""}${you?.place ?? ""}`,
      picks: allIn ? "All in" : "1 owed",
      survivor: `${seats.filter((seat) => !seat.out).length} of ${seats.length} still in · ${seats.find((seat) => seat.name === LAB_VIEWER)?.out ? "You’re out" : "You’re in"}`,
      bowl: "Open now",
    },
    owed: !allIn,
    mail,
    bowl: season === "bowls",
  };
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
  // The Bowl Pool's bulletin board is wheeled in for bowl season (from Dec 7).
  const bulletin = feed.bowl;
  const key = `${bulletin ? "-bowl" : ""}${wide ? "-wide" : full ? "-full" : ""}`;
  const picture = PICTURES[`day${key}`] ?? PICTURES[`day${bulletin ? "-bowl" : ""}`];
  const news = feed.news;
  // The poker table is whichever pool is being played: Survivor while it runs, the Bowl Pool in bowl season (in the Bowl Pool's navy and
  // gold), never both; between the two (Survivor decided, the Bowl Pool not open yet) it has no plate. (Both are always on the board's tabs.)
  // The real clubhouse has no other Bowl Pool plate; the Lab keeps its bulletin board's.
  const survivorActive = feed.survivorActive ?? !feed.survivorOver;
  const table: "survivor" | "bowl" | null = survivorActive ? "survivor" : feed.bowl ? "bowl" : null;
  const taken = table === "bowl";
  const spots = SPOTS.flatMap((item) => {
    if (item.spot === "bowl" && (hrefFor || !picture.spots.bowl)) return [];
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
      <RoomNews feed={feed} frame={frame} picture={picture} />
      {spots.map(({ spot, room: next, name, tag, label, at: tall, wideAt, fullAt, ticket }) => {
        const free = wide ? wideAt ?? tall : full ? fullAt ?? tall : tall;
        // Filling the screen crops the picture a little at its sides; a plate that would be cut off there is drawn in from the edge: the
        // chimney's (Trophies, Rules) at the left, the bar's chat plate at the right. (The chat plate's red new-message flag hangs off its
        // left end, into the room, so it never needs room at the edge.)
        const at = picture.spots[spot];
        let plateStyle: CSSProperties | undefined;
        if (full && frame && at && typeof window !== "undefined") {
          const crop = Math.max(0, (frame.width - document.documentElement.clientWidth) / 2) + 6;
          if (spot === "trophies" || spot === "constitution") plateStyle = { left: Math.max(0, crop - at.x * frame.width) };
          if (spot === "chat") plateStyle = { right: Math.max(0, at.x * frame.width + Math.max(at.w * frame.width, 44) - (frame.width - crop)) };   // a spot is never under 44px wide
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

/** The Lab's room: the sample league in the picture, and the plain list of rooms below. */
function ClubRoom({ season, allIn, mail, onEnter }: { season: Season; allIn: boolean; mail: boolean; onEnter: (room: Room, ticket?: boolean) => void }) {
  return (
    <>
      <RoomScene feed={labFeed(season, allIn, mail)} onSpot={(_spot, next, ticket) => onEnter(next, ticket)} />
      <div aria-label="Rooms" className="lab-room-list" role="group">
        {(["board", "survivor", "trophies", "constitution", "chat", ...(season === "bowls" ? ["bowl"] : [])] as Room[]).map((room) => (
          <button key={room} onClick={() => onEnter(room)} type="button">{ROOM_TITLE[room]}{room === "chat" && mail ? " · new" : ""}</button>
        ))}
      </div>
    </>
  );
}

/**
 * The pool's constitution, posted in full: the very text the Commissioner Handbook holds, so the two can never differ. Quick to use:
 * a row of the ten articles at the top jumps straight to one, each article is a short numbered list, and the three parts are headed
 * like the sections of a printed rule book.
 */
export function Constitution() {
  const articles = POOL_CONSTITUTION.flatMap(({ articles: list }) => list);
  const idFor = (title: string) => `rule-${title.split(" · ")[0].split(" ")[1].toLowerCase()}`;
  return (
    <article aria-label="Pool constitution" className="lab-rules">
      <header>
        <p>THE JOE BARR MEMORIAL PICK’EM</p>
        <h4>Pool Constitution</h4>
      </header>
      <nav aria-label="Articles" className="lab-rules-index">
        {articles.map(({ title }) => {
          const [number, name] = title.split(" · ");
          return <a href={`#${idFor(title)}`} key={title} onClick={(event) => { event.preventDefault(); document.getElementById(idFor(title))?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><b>{number.replace("Article ", "")}</b>{name}</a>;
        })}
      </nav>
      {POOL_CONSTITUTION.map(({ part, articles: list }) => (
        <section aria-label={part} className="lab-rules-part" key={part}>
          <h5>{part}</h5>
          {list.map(({ title, clauses }) => {
            const [number, name] = title.split(" · ");
            return (
              <section aria-labelledby={`${idFor(title)}-title`} className="lab-rules-article" id={idFor(title)} key={title}>
                <h6 id={`${idFor(title)}-title`}><span>{number}</span>{name}</h6>
                <ol>{clauses.map((clause) => <li key={clause}>{clause}</li>)}</ol>
              </section>
            );
          })}
        </section>
      ))}
    </article>
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
  // Every room opens at its top, and going back lands you at the room picture, not wherever the page had scrolled to.
  const enter = (next: Room, ticket = false) => { setRoom(next); setTicketOpen(ticket); setVisit((count) => count + 1); window.scrollTo({ top: 0 }); };
  const leave = () => { setRoom(null); window.scrollTo({ top: 0 }); };
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
          <button className="lab-room-back" onClick={leave} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{ROOM_TITLE[room]}</h3>
        </header>
      )}
      {room === "board" ? <BigBoardRoom key={visit} onSurvivor={() => enter("survivor")} onTicket={setAllIn} startOpen={ticketOpen} survivorIn={allIn} /> : null}
      {room === "trophies" ? <TrophyRoom /> : null}
      {room === "survivor" ? <LabSurvivorTable /> : null}
      {room === "chat" ? <StandIn>The pool chat opens here, exactly as it works today.</StandIn> : null}
      {room === "bowl" ? <StandIn>The Bowl Pool opens here.</StandIn> : null}
      {room === "constitution" ? <Constitution /> : null}
      {room !== null ? <button className="lab-room-back is-foot" onClick={leave} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button> : null}
      <RoomTicket onOpen={() => enter("board", true)} ticket={{
        places: [{ team: "PIT", line: "-2.5", label: "", note: "Sun 1:00", state: "in" }, { team: "IND", line: "+3.5", label: "", note: "Sun 4:25", state: "in" }, allIn ? { team: "KC", label: "Survivor", note: "Thu 8:15", state: "in", survivor: true } : { label: "Survivor", note: "Open", state: "off", survivor: true }],
        status: allIn ? { label: "All in", text: "Change until kickoff" } : { label: "Next game", text: "Thu 8:15 PM" }, urgent: !allIn, action: allIn ? "VIEW" : "PICK", stub: allIn ? "ALL IN" : "1 LEFT",
      }} week="Week 10" />
    </section>
  );
}
