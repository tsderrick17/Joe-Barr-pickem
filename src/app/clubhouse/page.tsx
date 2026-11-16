"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PoolChat from "@/components/pool-chat";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { BoardPopup, SurvivorPopup, TicketPopup, TrophyPopup } from "@/components/clubhouse-popups";
import { Constitution, RoomScene, Ticket, type RoomFeed } from "@/components/lab/lab-clubhouse";
import type { LampState } from "@/components/lab/lab-tote";
import { FootballLoadingScreen } from "@/components/football-loader";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import type { SlateResponse, StandingsResponse } from "@/lib/api-contracts";
import { boardViewSupported, realBoardView } from "@/lib/board-view.js";
import { clubhouseFeed } from "@/lib/clubhouse-feed.js";
import { paneForHref, paneFromHash } from "@/lib/clubhouse-mode.js";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";
import { useStableCallback } from "@/lib/use-stable-callback";

/**
 * The clubhouse: another way to live in the same site, for the Commissioner only for now.
 *
 * One screen that never scrolls. The room is the front door; everything else is a pop-up over it, showing the new views on the pool's real data:
 *  - the Big Board and Survivor's spots open the Big Board (everyone's picks, and the ticket that sends yours), the games board / Your picks /
 *    the ticket open the same board with the ticket ready, the Survivor spot the Survivor table, the trophy the Trophy Room (trophies,
 *    plaques, records), the constitution the rules; the chat is a sheet. Only the Bowl Pool (and a playoff week, which has a pick for every
 *    game) still opens the classic page, in place;
 *  - each open pop-up has its own address (#slate...), so the phone's back gesture closes it, a reload brings it back, and a link to another
 *    page (the header's, or one inside a pop-up) opens that page's pop-up in place rather than leaving the screen;
 *  - the room's boards and ticket come from one read (the Standings' and the Slate's own), which is read again whenever a pop-up is closed
 *    or a pick is sent (so a pick shows in the ticket's lamps at once), when the app comes back to the front, and every five minutes.
 * It can never show more than the classic pages do, and a pick sent here is the very same pick (the same POST the Slate makes).
 */
type Pane = "standings" | "slate" | "survivor" | "trophies" | "bowl" | "rules";
const SPOT_PANE: Record<string, Pane> = { board: "standings", survivor: "survivor", sportsbook: "slate", picks: "slate", trophies: "trophies", bowl: "bowl", constitution: "rules" };
const TITLE: Record<Pane, string> = { standings: "The Big Board", slate: "The Big Board", survivor: "Survivor", trophies: "Trophy Room", bowl: "NCAA Bowls", rules: "Constitution" };
// The classic pages, loaded the first time they are opened: the Bowl Pool, and the playoff weeks the new board does not cover yet.
const PAGES: Record<"standings" | "slate" | "bowl", ReturnType<typeof dynamic>> = {
  standings: dynamic(() => import("@/app/page")),
  slate: dynamic(() => import("@/app/board/page")),
  bowl: dynamic(() => import("@/app/bowl-pool/page")),
};

const REFRESH_MS = 5 * 60_000;       // as often as the Standings itself reads again
const RETURN_GAP_MS = 30_000;        // coming back to the app sooner than this reads nothing new

type Room = { feed: RoomFeed; ticket: { lamps: LampState[]; line: string; survivor: boolean } | null; home: StandingsResponse; board: SlateResponse };

export default function ClubhousePage() {
  const access = useCommissionerAccess();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [pane, setPane] = useState<Pane | null>(null);
  const paneRef = useRef<Pane | null>(null);   // the pop-up that is current, so a pop-up closing under a newer one does not close that one
  const [ticketOpen, setTicketOpen] = useState(false);   // your ticket, over the Big Board
  useEffect(() => { paneRef.current = pane; }, [pane]);
  const openedHere = useRef(false);   // this pane was opened from the room in this visit, so closing it is one step back
  const lastRead = useRef(0);
  const wasOpen = useRef(false);
  const main = useRef<HTMLElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState({ top: 0, bar: 0 });

  // One screen, no scrolling: the page holds still; each open page scrolls inside itself.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    return () => { html.style.overflow = before[0]; body.style.overflow = before[1]; };
  }, []);

  useEffect(() => { if (access === "denied") router.replace("/"); }, [access, router]);

  const read = useStableCallback(async (first: boolean) => {
    try {
      // The Slate's read needs a week: bootstrap=1 asks for the default week, as the Slate itself does on first load.
      const [homeResponse, boardResponse] = await Promise.all([fetchWithSession("/api/home"), fetchWithSession("/api/board?bootstrap=1")]);
      const home = await homeResponse.json() as StandingsResponse;
      if (!homeResponse.ok) throw new Error(home.error ?? "The clubhouse could not be loaded.");
      // Without the week's games the room still opens: the standings on the Big Board, the games board dark, no ticket.
      const board = boardResponse.ok ? await boardResponse.json() as SlateResponse : { games: [], myPicks: [], serverTime: home.serverTime } as unknown as SlateResponse;
      lastRead.current = Date.now();
      setRoom({ ...(clubhouseFeed({ home, board }) as Omit<Room, "home" | "board">), home, board });
      setError("");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      // A later read that fails leaves the room as it was; only the first one has nothing to show.
      else if (first) setError(reason instanceof Error ? reason.message : "The clubhouse could not be loaded.");
    }
  });

  useEffect(() => { if (access === "allowed") void read(true); }, [access, read]);

  // The room is read again when a page is closed (the ticket must show the pick just made), when the app returns to the front after a
  // while, and every five minutes while the room itself is what is on screen.
  const paneOpen = pane !== null;
  useEffect(() => {
    if (access !== "allowed") return;
    if (paneOpen) { wasOpen.current = true; return; }
    if (wasOpen.current) { wasOpen.current = false; void read(false); }   // a page was just closed
    const timer = window.setInterval(() => void read(false), REFRESH_MS);
    const back = () => { if (document.visibilityState === "visible" && Date.now() - lastRead.current > RETURN_GAP_MS) void read(false); };
    document.addEventListener("visibilitychange", back);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", back); };
  }, [access, paneOpen, read]);

  // The open page is part of the address: #slate. Back closes it, a reload reopens it.
  useEffect(() => {
    const sync = () => { const next = paneFromHash(window.location.hash) as Pane | null; setPane(next); setTicketOpen(next === "slate"); };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, []);

  const show = useCallback((next: Pane) => {
    setChatOpen(false);
    if (paneFromHash(window.location.hash)) window.history.replaceState(null, "", `/clubhouse#${next}`);   // page to page: still one step back to the room
    else { window.history.pushState(null, "", `/clubhouse#${next}`); openedHere.current = true; }
    setPane(next);
    setTicketOpen(next === "slate");   // the games board, Your picks and the ticket open the board with your ticket ready
  }, []);
  const close = useCallback(() => {
    if (openedHere.current) { openedHere.current = false; window.history.back(); }
    else { window.history.replaceState(null, "", "/clubhouse"); setPane(null); }
  }, []);

  // A link to another real page opens it in place (the header's links, and the links inside the open pages); the light switch and links
  // out of the clubhouse (the profile, the Commissioner's pages) behave as links do.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.classList.contains("view-switch") || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const next = paneForHref(link.getAttribute("href") ?? "", window.location.origin) as Pane | null;
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      show(next);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [show]);

  useEffect(() => {
    if (!pane) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pane, close]);

  // An open page starts exactly where the room does (under the whole header, not just its sticky part), and the Slate's own sticky
  // receipt bar rides just under the way back, not under the header it never sees.
  useLayoutEffect(() => {
    const measure = () => setFrame({ top: Math.round((main.current?.getBoundingClientRect().top ?? 0) + window.scrollY), bar: bar.current?.offsetHeight ?? 0 });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [room, pane]);

  // Which pop-up is open: the new views, or (the Bowl Pool, and a playoff week) the classic page in place.
  const newBoard = room ? boardViewSupported(room.home, room.board) : false;
  const view = useMemo(() => (room && newBoard ? realBoardView({ home: room.home, board: room.board }) : null), [room, newBoard]);
  const popup = (...panes: Pane[]) => Boolean(pane && panes.includes(pane) && (pane === "survivor" ? !room?.home.isPlayoff : pane === "standings" || pane === "slate" ? newBoard : true));
  const classic: "standings" | "slate" | "bowl" | null = pane === "bowl" ? "bowl" : pane === "standings" || pane === "slate" ? (newBoard ? null : pane) : pane === "survivor" && room?.home.isPlayoff ? "standings" : null;
  const leave = (...panes: Pane[]) => { if (paneRef.current && panes.includes(paneRef.current)) close(); };

  // Once Survivor is over, its poker table is the Bowl Pool's.
  const paneOfSpot = (spot: string): Pane | null => (spot === "survivor" && room?.feed.survivorOver ? "bowl" : SPOT_PANE[spot] ?? null);

  if (error) return <main className="clubhouse-page"><p className="dash-error" role="alert">{error}</p></main>;
  if (!room) return <FootballLoadingScreen background="bg-(color:--themed-bg-18) text-(color:--themed-text-18)" />;
  return (
    <main aria-label="Clubhouse" className="clubhouse-page" ref={main}>
      <RoomScene feed={room.feed} full hrefFor={(spot) => (spot === "chat" ? "#chat" : paneOfSpot(spot) ? `#${paneOfSpot(spot)}` : null)} onSpot={(spot) => { if (spot === "chat") setChatOpen(true); else if (paneOfSpot(spot)) show(paneOfSpot(spot)!); }} />
      <Sheet onClose={() => setChatOpen(false)} open={chatOpen} title="Pool chat"><PoolChat onHide={() => setChatOpen(false)} /></Sheet>
      {room.ticket ? <Ticket lamps={room.ticket.lamps} line={room.ticket.line} survivor={room.ticket.survivor} onOpen={() => show("slate")} week={room.feed.week} /> : null}
      {popup("standings", "slate") && view ? <Sheet onClose={() => leave("standings", "slate")} open title="The Big Board">
        <BoardPopup home={room.home} onOpenTicket={() => setTicketOpen(true)} onSurvivor={() => show("survivor")} view={view} />
      </Sheet> : null}
      {popup("standings", "slate") && view ? <TicketPopup onChanged={() => read(false)} onClose={() => setTicketOpen(false)} open={ticketOpen} view={view} /> : null}
      {popup("survivor") ? <Sheet onClose={() => leave("survivor")} open title="Survivor"><SurvivorPopup home={room.home} /></Sheet> : null}
      {popup("trophies") ? <Sheet onClose={() => leave("trophies")} open title="Trophy Room"><TrophyPopup /></Sheet> : null}
      {popup("rules") ? <Sheet onClose={() => leave("rules")} open title="Constitution"><Constitution /></Sheet> : null}
      {classic ? <section aria-label={TITLE[classic] === "The Big Board" ? "Standings" : TITLE[classic]} className="clubhouse-pane" style={{ top: frame.top, ["--site-nav-height" as string]: `${frame.bar}px` }}>
        <header className="lab-room-bar" ref={bar}>
          <button className="lab-room-back" onClick={close} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{classic === "slate" ? "The Slate" : TITLE[classic]}</h3>
        </header>
        {(() => { const Page = PAGES[classic]; return <Page />; })()}
      </section> : null}
    </main>
  );
}
