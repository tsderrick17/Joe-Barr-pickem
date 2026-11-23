"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { haptic } from "@/lib/haptics-client";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { BoardPopup, BowlPopup, ClubChat, prefetchBowlPool, prefetchPoolChat, prefetchTrophyRoom, DeckTabs, savedTime, SurvivorPopup, TicketPanel, TrophyPopup, UnsentPicks, type DeckTab } from "@/components/clubhouse/popups";
import { Constitution } from "@/components/clubhouse/constitution";
import { RoomScene, warmRoomPicture, type RoomFeed } from "@/components/clubhouse/room-scene";
import { RoomTicket, type RoomTicketData } from "@/components/clubhouse/room-ticket";
import { FootballLoadingScreen } from "@/components/football-loader";
import SeasonSnapshot, { snapshotRefreshKey } from "@/components/season-snapshot";
import { PULL_REFRESH_EVENT } from "@/components/pull-to-refresh";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import type { SlateResponse, StandingsResponse } from "@/lib/api-contracts";
import { boardViewSupported, realBoardView } from "@/lib/board-view.js";
import { bowlChartReady, bowlSnapshot } from "@/lib/chalkboard.js";
import { bowlTickerGames, clubhouseFeed, mergeTicker } from "@/lib/clubhouse-feed.js";
import { paneForHref, paneFromHash, setClubhouseMode } from "@/lib/clubhouse-mode.js";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period.js";
import { useClubhouseAccess } from "@/lib/use-commissioner-access";
import { useStableCallback } from "@/lib/use-stable-callback";

/**
 * The clubhouse: another way to live in the same site, for the Commissioner only for now.
 *
 * One screen that never scrolls. The room is the front door; everything else is a pop-up over it, showing the new views on the pool's real data:
 *  - the Big Board and Survivor's spots open the Big Board (everyone's picks, and the ticket that sends yours), the games board / Your picks /
 *    the ticket open the same board with the ticket ready (a playoff round too: a pick for every game, and the race to catch the
 *    leader), the Survivor spot the Survivor table, the trophy the Trophy Room (trophies, plaques, records), the constitution the rules,
 *    the Bowl Pool's spot the Bowl ticket (picks and standings); the chat is a sheet. Only a week the new board does not cover opens the
 *    classic page, in place;
 *  - each open pop-up has its own address (#slate...), so the phone's back gesture closes it, a reload brings it back, and a link to another
 *    page (the header's, or one inside a pop-up) opens that page's pop-up in place rather than leaving the screen;
 *  - the room's boards and ticket come from one read (the Standings' and the Slate's own), which is read again whenever a pop-up is closed
 *    or a pick is sent (so a pick shows in the ticket's lamps at once), when the app comes back to the front, and every five minutes.
 * It can never show more than the classic pages do, and a pick sent here is the very same pick (the same POST the Slate makes).
 */
const TUCK_KEY = "pickem-ticket-tucked";
const TUCK_EVENT = "pickem-ticket-tuck";
const readTicketTuck = () => { try { return window.localStorage.getItem(TUCK_KEY) === "1"; } catch { return false; } };
const writeTicketTuck = (tucked: boolean) => { try { window.localStorage.setItem(TUCK_KEY, tucked ? "1" : "0"); } catch { /* kept for this visit only */ } window.dispatchEvent(new Event(TUCK_EVENT)); };
const subscribeTicketTuck = (notify: () => void) => { window.addEventListener(TUCK_EVENT, notify); return () => window.removeEventListener(TUCK_EVENT, notify); };

type Pane = "standings" | "slate" | "survivor" | "trophies" | "bowl" | "rules" | "notifications" | "snapshot";
const SPOT_PANE: Record<string, Pane> = { board: "standings", survivor: "survivor", sportsbook: "slate", picks: "slate", trophies: "trophies", bowl: "bowl", constitution: "rules", notify: "notifications", chalkboard: "snapshot" };
const TITLE: Record<Pane, string> = { standings: "The Big Board", slate: "Your ticket", survivor: "Survivor", trophies: "Trophy Room", bowl: "Bowl Pool", rules: "Constitution", notifications: "Notifications", snapshot: "Season Snapshot" };
// Notifications (the app, phone notifications, the email plan) is loaded only when its pop-up is opened.
const NotificationSettings = dynamic(() => import("@/components/notification-settings").then((module) => module.NotificationSettings));
// The board's panes: one sheet with a switch on top (Big Board, your Ticket, then Survivor or the Bowl Pool by the time of year).
const DECK: Pane[] = ["standings", "slate", "survivor", "bowl"];
// The classic pages, loaded the first time they are opened: any week the new board does not cover.
const PAGES: Record<"standings" | "slate", ReturnType<typeof dynamic>> = {
  standings: dynamic(() => import("@/app/page")),
  slate: dynamic(() => import("@/app/board/page")),
};

const REFRESH_MS = 5 * 60_000;       // as often as the Standings itself reads again
const RETURN_GAP_MS = 30_000;        // coming back to the app sooner than this reads nothing new

type Room = { feed: RoomFeed; ticket: RoomTicketData | null; home: StandingsResponse; board: SlateResponse };

/**
 * Every player's wins as they stood a week ago, for the Big Board's ▲▼: through last week once this week has a graded game, else through
 * the week before (so the arrows show last week's moves until this week's games start to count). Regular season only; any failure just
 * leaves the arrows off.
 */
/** A finished week's totals never change, so each is read once per visit. */
const totalsByWeek = new Map<string, Promise<Record<string, number> | null>>();
async function standingsBefore(board: SlateResponse): Promise<Record<string, number> | null> {
  const weeks = (board.bootstrap?.weeks ?? []).filter((week) => week.period_type === "regular").sort((a, b) => a.display_order - b.display_order);
  const current = selectDefaultScoringPeriod(board.bootstrap?.weeks ?? []);
  const at = current && current.period_type === "regular" ? weeks.findIndex((week) => week.id === current.id) : -1;
  if (at < 0) return null;
  const graded = (board.games ?? []).some((game) => game.status === "final");
  const base = weeks[at - (graded ? 1 : 2)];
  if (!base) return null;
  const known = totalsByWeek.get(base.id);
  if (known) return known;
  const read = (async () => {
    try {
      const response = await fetchWithSession(`/api/board-totals?week=${encodeURIComponent(base.id)}`, { cache: "no-store" });
      if (!response.ok) return null;
      return ((await response.json()) as { totals?: Record<string, number> }).totals ?? null;
    } catch {
      return null;
    }
  })();
  totalsByWeek.set(base.id, read);
  const totals = await read;
  if (!totals) totalsByWeek.delete(base.id);   // a failed read is tried again next time
  return totals;
}

export default function ClubhousePage() {
  const access = useClubhouseAccess();   // the Commissioner and the clubhouse beta's players
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [pane, setPane] = useState<Pane | null>(null);
  const paneRef = useRef<Pane | null>(null);   // the pop-up that is current, so a pop-up closing under a newer one does not close that one
  const [lookBack, setLookBack] = useState<{ weekId: string; board: SlateResponse; totals: Record<string, number> } | null>(null);   // another week on the Big Board: that week's Slate, and every player's wins added up through it
  useEffect(() => { paneRef.current = pane; }, [pane]);
  // A ticket (Pick'em or the Bowl Pool's) holding picks not sent yet: how to send them. Putting the ticket away first asks (see UnsentPicks).
  const unsent = useRef<(() => Promise<boolean>) | null>(null);
  const holdUnsent = useCallback((send: (() => Promise<boolean>) | null) => { unsent.current = send; }, []);
  const [asking, setAsking] = useState<{ go: () => void } | null>(null);
  const [sendingUnsent, setSendingUnsent] = useState(false);
  const askingRef = useRef(false);
  useEffect(() => { askingRef.current = asking !== null; }, [asking]);
  /** Runs `go` at once, or, while picks are waiting to be sent, asks first. */
  const guarded = useCallback((go: () => void) => { if (unsent.current) setAsking({ go }); else go(); }, []);
  // Closing the board's sheet with picks waiting: the sheet stays up and asks; once answered it slides away on this signal.
  const [deckClose, setDeckClose] = useState(0);
  const holdDeck = useCallback(() => { if (!unsent.current) return true; setAsking({ go: () => setDeckClose((count) => count + 1) }); return false; }, []);
  // When each week's picks were last saved here, for the Big Board's bar ("Saved at 7:42 PM").
  const [savedAt, setSavedAt] = useState<{ weekId: string; time: string } | null>(null);
  const openedHere = useRef(false);   // this pane was opened from the room in this visit, so closing it is one step back
  const lastRead = useRef(0);
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

  // Not let in (or the account could not be read): the switch goes down on this device, so the Standings do not send them straight back.
  useEffect(() => { if (access === "denied") { setClubhouseMode(false); router.replace("/"); } }, [access, router]);

  const read = useStableCallback(async (first: boolean) => {
    try {
      // The Slate's read needs a week: bootstrap=1 asks for the default week, as the Slate itself does on first load.
      const [homeResponse, boardResponse] = await Promise.all([fetchWithSession("/api/home"), fetchWithSession("/api/board?bootstrap=1")]);
      const home = await homeResponse.json() as StandingsResponse;
      if (!homeResponse.ok) throw new Error(home.error ?? "The clubhouse could not be loaded.");
      // Without the week's games the room still opens: the standings on the Big Board, the games board dark, no ticket.
      const board = boardResponse.ok ? await boardResponse.json() as SlateResponse : { games: [], myPicks: [], serverTime: home.serverTime } as unknown as SlateResponse;
      lastRead.current = Date.now();
      // The room is drawn at once; last week's totals (only the Big Board's ▲▼ use them) follow, and are asked for once a visit.
      const ready = totalsByWeek.size > 0 ? null : clubhouseFeed({ home, board, before: null });
      if (ready) setRoom({ ...(ready as Omit<Room, "home" | "board">), home, board });
      const before = await standingsBefore(board);
      setRoom({ ...(clubhouseFeed({ home, board, before }) as Omit<Room, "home" | "board">), home, board });
      setError("");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      // A later read that fails leaves the room as it was; only the first one has nothing to show.
      else if (first) setError(reason instanceof Error ? reason.message : "The clubhouse could not be loaded.");
    }
  });

  // The room's picture starts down as the page opens, alongside the sign-in check and the pool's reads.
  useEffect(() => { warmRoomPicture(); }, []);
  useEffect(() => { if (access === "allowed") void read(true); }, [access, read]);
  // Pulling down to refresh reads the room again in place (no reload, no loading screen): the chain stays down until it is in.
  useEffect(() => {
    const refresh = (event: Event) => {
      event.preventDefault();
      (event as CustomEvent<{ done: Promise<void> | null }>).detail.done = read(false);
    };
    window.addEventListener(PULL_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(PULL_REFRESH_EVENT, refresh);
  }, [read]);

  // The room is read again when the app returns to the front after a while, and every five minutes while the room itself is what is on
  // screen. (A pick sent from the ticket reads it again straight away; closing a pop-up that changed nothing does not.)
  const paneOpen = pane !== null;
  useEffect(() => {
    if (access !== "allowed" || paneOpen) return;
    const timer = window.setInterval(() => void read(false), REFRESH_MS);
    const back = () => { if (document.visibilityState === "visible" && Date.now() - lastRead.current > RETURN_GAP_MS) void read(false); };
    document.addEventListener("visibilitychange", back);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", back); };
  }, [access, paneOpen, read]);

  // The open page is part of the address: #slate. Back closes it, a reload reopens it.
  useEffect(() => {
    const sync = () => {
      const next = paneFromHash(window.location.hash) as Pane | null;
      // The back gesture away from a ticket with picks waiting: stay on it and ask; leaving goes back after all.
      const current = paneRef.current;
      if (current && next !== current && (unsent.current || askingRef.current)) {
        window.history.pushState(null, "", `/clubhouse#${current}`);
        if (!askingRef.current) setAsking({ go: () => window.history.back() });
        return;
      }
      setPane(next);
      if (window.location.hash === "#chat") setChatOpen(true);   // #chat opens the chat
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, []);

  const closeChat = useCallback(() => { setChatOpen(false); if (window.location.hash === "#chat") window.history.replaceState(null, "", "/clubhouse"); }, []);
  // Which side your ticket opens on: Pick'em, or Survivor when the Survivor table's Pick button opened it (only for that one opening).
  const [ticketStart, setTicketStart] = useState<"pickem" | "survivor">("pickem");
  const show = useCallback((next: Pane, start: "pickem" | "survivor" = "pickem") => {
    setChatOpen(false);
    setTicketStart(start);
    if (paneFromHash(window.location.hash)) window.history.replaceState(null, "", `/clubhouse#${next}`);   // page to page: still one step back to the room
    else { window.history.pushState(null, "", `/clubhouse#${next}`); openedHere.current = true; setLookBack(null); }   // opened from the room: the board starts on this week
    setPane(next);
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

  // Which pop-up is open: the new views, or (a week the new board does not cover) the classic page in place.
  const newBoard = room ? boardViewSupported(room.home, room.board) : false;
  const view = useMemo(() => (room && newBoard ? realBoardView({ home: room.home, board: lookBack?.board ?? room.board }, { weekId: lookBack?.weekId ?? null, totals: lookBack?.totals ?? null }) : null), [room, newBoard, lookBack]);
  // The Big Board opens on this week; choosing another week reads that week from the Slate (the default week is the room's own read).
  const chooseWeek = useStableCallback(async (weekId: string) => {
    const current = room ? selectDefaultScoringPeriod(room.board.bootstrap?.weeks ?? [])?.id : null;
    if (!room || weekId === (lookBack?.weekId ?? current)) return;
    if (weekId === current) { setLookBack(null); return; }
    try {
      // The week's own games and picks, and the pool's running wins through it: the board shows the pool as it stood when that week ended.
      const [response, totals] = await Promise.all([
        fetchWithSession(`/api/board?bootstrap=1&week=${encodeURIComponent(weekId)}`, { cache: "no-store" }),
        fetchWithSession(`/api/board-totals?week=${encodeURIComponent(weekId)}`, { cache: "no-store" }),
      ]);
      if (!response.ok || !totals.ok) return;
      setLookBack({ weekId, board: await response.json() as SlateResponse, totals: ((await totals.json()) as { totals?: Record<string, number> }).totals ?? {} });
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
    }
  });
  const shown: Pane | null = pane;
  // Your ticket tucked away to half its height, or whole: remembered on this device.
  const ticketTucked = useSyncExternalStore(subscribeTicketTuck, readTicketTuck, () => false);
  const tuckTicket = useCallback((tucked: boolean) => { haptic("tick"); writeTicketTuck(tucked); }, []);
  const popup = (...panes: Pane[]) => Boolean(shown && panes.includes(shown) && (shown === "standings" || shown === "slate" ? newBoard : true));
  const classic: "standings" | "slate" | null = shown === "standings" || shown === "slate" ? (newBoard ? null : shown) : null;
  // The board's sheet: which pane it shows, and its switch, always all four: the Bowl Pool, Survivor, Ticket and the Big Board.
  const deck: Pane | null = shown && DECK.includes(shown) && popup(shown) && (shown === "survivor" || shown === "bowl" || view) ? shown : null;
  // Bowl Pool, Survivor, Ticket, then the Big Board at the right.
  const tabs: DeckTab[] = [{ pane: "bowl", label: "Bowl Pool" }, { pane: "survivor", label: "Survivor" }, ...(view ? [{ pane: "slate", label: "Ticket" }, { pane: "standings", label: "Big Board" }] : [])];
  // The Bowl Pool's read, fetched ahead once its spot is in the room, so its ticket opens already full.
  const bowlInRoom = Boolean(room?.feed.bowl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Bowl Pool's read, as the classic page takes it
  const [bowlRead, setBowlRead] = useState<any>(null);
  useEffect(() => { if (bowlInRoom) void prefetchBowlPool().then(setBowlRead); }, [bowlInRoom]);
  // The chalkboard in the room is a still chalk drawing; tapping it opens the Season Snapshot, which reads its chart when it opens, for
  // everyone who can see it on the Standings (the Commissioner, and every player once Week 6 has settled); once 10 bowls are final it
  // gains the Bowl Pool's chart, from the Bowl Pool's read above.
  const snapshotOpen = Boolean(room && (room.home.isCommissioner || room.home.seasonSnapshotReleased));
  const snapshotKey = room ? snapshotRefreshKey(room.home.rows) : "";
  const snapshotPlayers = useMemo(() => (room?.home.rows ?? []).map((row) => ({ id: row.id, firstName: row.firstName, wins: row.wins, eliminated: row.playoffEliminated })), [room]);
  // The Bowl Pool's chart joins once its first 10 bowls are final.
  const bowlChart = useMemo(() => (bowlInRoom && bowlRead && bowlChartReady(bowlRead) ? bowlSnapshot(bowlRead) : null), [bowlInRoom, bowlRead]);
  // In bowl season the room's ticker carries the bowls too: today's NFL games, today's bowls, then the rest sprinkled through each other.
  const roomFeed = useMemo(() => {
    if (!room) return null;
    if (!room.feed.bowl || !bowlRead) return room.feed;
    const now = Date.parse(room.board.serverTime ?? room.home.serverTime ?? new Date().toISOString());
    return { ...room.feed, games: mergeTicker(room.feed.games, bowlTickerGames(bowlRead, now), now) };
  }, [room, bowlRead]);
  // The Trophy Room and the chat too, once the room is up.
  const roomUp = Boolean(room);
  // The chat and the Trophy Room are read ahead once the room has settled (not while it is still loading), so each opens already full;
  // the Trophy Room's read (the pool's whole history, the heaviest) is also kept by the browser for five minutes.
  useEffect(() => {
    if (!roomUp) return;
    const timer = window.setTimeout(() => { void prefetchPoolChat(); void prefetchTrophyRoom(); }, 3000);
    return () => window.clearTimeout(timer);
  }, [roomUp]);
  const leave = (...panes: Pane[]) => { if (paneRef.current && panes.includes(paneRef.current)) close(); };

  // The poker table is the Bowl Pool's in bowl season (once Survivor is no longer being played).
  const paneOfSpot = (spot: string): Pane | null => (spot === "survivor" && room && !room.feed.survivorActive && room.feed.bowl ? "bowl" : SPOT_PANE[spot] ?? null);

  if (error) return <main className="clubhouse-page"><p className="dash-error" role="alert">{error}</p></main>;
  if (!room) return <FootballLoadingScreen background="bg-(color:--themed-bg-18) text-(color:--themed-text-18)" />;
  return (
    <main aria-label="Clubhouse" className="clubhouse-page" ref={main}>
      <RoomScene feed={roomFeed ?? room.feed} full hrefFor={(spot) => (spot === "chat" ? "#chat" : paneOfSpot(spot) ? `#${paneOfSpot(spot)}` : null)} onSpot={(spot) => { if (spot === "chat") setChatOpen(true); else if (paneOfSpot(spot)) show(paneOfSpot(spot)!); }} />
      <Sheet bare onClose={closeChat} open={chatOpen} title="Pool chat"><ClubChat onHide={closeChat} /></Sheet>
      {room.ticket ? <RoomTicket onOpen={() => show("slate")} onTuck={tuckTicket} tucked={ticketTucked} savedAt={savedAt && savedAt.weekId === view?.weekId ? savedAt.time : null} ticket={room.ticket} week={room.feed.week} /> : null}
      {deck ? <Sheet bare closeSignal={deckClose} guard={holdDeck} onClose={() => { unsent.current = null; leave(...DECK); }} open title={TITLE[deck]}>
        {tabs.length > 1 ? <DeckTabs current={deck} onChoose={(next) => guarded(() => show(next as Pane))} tabs={tabs} /> : null}
        {deck === "standings" && view ? <BoardPopup onOpenTicket={() => show("slate")} onWeek={(weekId) => void chooseWeek(weekId)} savedAt={savedAt && savedAt.weekId === view.weekId ? savedAt.time : null} view={view} /> : null}
        {deck === "slate" && view ? <TicketPanel onChanged={() => read(false)} onDirty={holdUnsent} onSaved={() => { unsent.current = null; if (view.weekId) setSavedAt({ weekId: view.weekId, time: savedTime() }); }} onSent={() => show("standings")} onWeek={(weekId) => guarded(() => void chooseWeek(weekId))} startOn={ticketStart} view={view} /> : null}
        {deck === "survivor" ? <SurvivorPopup home={room.home} onPick={view?.survivor.playing ? () => show("slate", "survivor") : undefined} /> : null}
        {deck === "bowl" ? <BowlPopup onDirty={holdUnsent} viewerPlayerId={room.home.viewerPlayerId ?? null} /> : null}
      </Sheet> : null}
      {asking ? <UnsentPicks
        bowl={deck === "bowl"}
        busy={sendingUnsent}
        onDrop={() => { const { go } = asking; unsent.current = null; setAsking(null); go(); }}
        onSend={() => {
          const send = unsent.current;
          if (!send) { const { go } = asking; setAsking(null); go(); return; }
          setSendingUnsent(true);
          void send().then((saved) => {
            setSendingUnsent(false);
            const { go } = asking;
            setAsking(null);
            // Saved: carry on to wherever the player was going. Not saved: back to the ticket, which says why.
            if (saved) { unsent.current = null; go(); }
          });
        }}
        onStay={() => setAsking(null)}
      /> : null}
      {popup("snapshot") ? <Sheet bare onClose={() => leave("snapshot")} open title="Season Snapshot"><div className="club-snapshot is-chalkboard pickem-ledger">
        {snapshotOpen || bowlChart ? <SeasonSnapshot active bowl={bowlChart} chalk isPlayoff={room.home.isPlayoff} refreshKey={snapshotKey} standings={snapshotPlayers} /> : <p className="season-snapshot-message">The Season Snapshot opens once every Week 6 pick has settled.</p>}
      </div></Sheet> : null}
      {popup("trophies") ? <Sheet bare onClose={() => leave("trophies")} open title="Trophy Room"><TrophyPopup /></Sheet> : null}
            {popup("rules") ? <Sheet bare onClose={() => leave("rules")} open title="Constitution"><Constitution /></Sheet> : null}
      {popup("notifications") ? <Sheet bare onClose={() => leave("notifications")} open title="Notifications"><div className="club-notify"><h3>Notifications</h3><NotificationSettings inSheet /></div></Sheet> : null}
      {classic ? <section aria-label="Standings" className="clubhouse-pane" style={{ top: frame.top, ["--site-nav-height" as string]: `${frame.bar}px` }}>
        <header className="lab-room-bar" ref={bar}>
          <button className="lab-room-back" onClick={close} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{classic === "slate" ? "The Slate" : TITLE[classic]}</h3>
        </header>
        {(() => { const Page = PAGES[classic]; return <Page />; })()}
      </section> : null}
    </main>
  );
}
