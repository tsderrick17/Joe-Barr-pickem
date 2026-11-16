"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PoolChat from "@/components/pool-chat";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { Constitution, RoomScene, Ticket, type RoomFeed } from "@/components/lab/lab-clubhouse";
import type { LampState } from "@/components/lab/lab-tote";
import { FootballLoadingScreen } from "@/components/football-loader";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import type { SlateResponse, StandingsResponse } from "@/lib/api-contracts";
import { clubhouseFeed } from "@/lib/clubhouse-feed.js";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";

/** What each thing in the room opens (Survivor's table is part of the Standings page): the real page itself, in place over the room (no leaving the screen). Chat opens as a sheet. */
type Pane = "standings" | "slate" | "trophies" | "bowl" | "rules";
const PANE: Record<string, Pane> = { board: "standings", sportsbook: "slate", picks: "slate", survivor: "standings", trophies: "trophies", bowl: "bowl", constitution: "rules" };
const TITLE: Record<Pane, string> = { standings: "Standings", slate: "The Slate", trophies: "Trophy Room", bowl: "NCAA Bowls", rules: "Constitution" };
// The real pages, loaded the first time they are opened.
const PAGES: Record<Exclude<Pane, "rules">, ReturnType<typeof dynamic>> = {
  standings: dynamic(() => import("@/app/page")),
  slate: dynamic(() => import("@/app/board/page")),
  trophies: dynamic(() => import("@/app/trophy-room/page")),
  bowl: dynamic(() => import("@/app/bowl-pool/page")),
};

/**
 * The clubhouse: another way into the same site, for the Commissioner only for now (the light switch beside the day/night button
 * brings you here and back). The room fills the screen; the boards in it show the real standings and this week's games with your own
 * picks lit, and every thing in it is a link to the real page (the Big Board to the Standings, the spreads to the Slate, the poker
 * table to Survivor, and so on). It reads only what the Standings and the Slate already read, so it can never show more than they do.
 */
export default function ClubhousePage() {
  const access = useCommissionerAccess();
  const router = useRouter();
  const [room, setRoom] = useState<{ feed: RoomFeed; ticket: { lamps: LampState[]; line: string } | null } | null>(null);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [pane, setPane] = useState<Pane | null>(null);
  const main = useRef<HTMLElement>(null);
  // A page opened over the room starts exactly where the room does: under the whole header, not just its sticky part.
  const [top, setTop] = useState(0);
  useLayoutEffect(() => { if (main.current) setTop(Math.round(main.current.getBoundingClientRect().top + window.scrollY)); }, [room, pane]);

  // One screen, no scrolling: the page itself holds still, and everything is reached from the room (the chat opens over it).
  useEffect(() => {
    const { documentElement: html, body } = document;
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    return () => { html.style.overflow = before[0]; body.style.overflow = before[1]; };
  }, []);

  useEffect(() => {
    if (access === "denied") router.replace("/");
    if (access !== "allowed") return;
    let disposed = false;
    void (async () => {
      try {
        // The Slate's read needs a week: bootstrap=1 asks for the default week, as the Slate itself does on first load.
        const [homeResponse, boardResponse] = await Promise.all([fetchWithSession("/api/home"), fetchWithSession("/api/board?bootstrap=1")]);
        const home = await homeResponse.json() as StandingsResponse;
        if (!homeResponse.ok) throw new Error(home.error ?? "The clubhouse could not be loaded.");
        // Without the week's games the room still opens: the standings on the Big Board, the games board dark, no ticket.
        const board = boardResponse.ok ? await boardResponse.json() as SlateResponse : { games: [], myPicks: [], serverTime: home.serverTime } as unknown as SlateResponse;
        if (!disposed) setRoom(clubhouseFeed({ home, board }) as { feed: RoomFeed; ticket: { lamps: LampState[]; line: string } | null });
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setError(reason instanceof Error ? reason.message : "The clubhouse could not be loaded.");
      }
    })();
    return () => { disposed = true; };
  }, [access, router]);

  if (error) return <main className="clubhouse-page"><p className="dash-error" role="alert">{error}</p></main>;
  if (!room) return <FootballLoadingScreen background="bg-(color:--themed-bg-18) text-(color:--themed-text-18)" />;
  return (
    <main aria-label="Clubhouse" className="clubhouse-page" ref={main}>
      <RoomScene feed={room.feed} full hrefFor={(spot) => (spot === "chat" ? "#chat" : PANE[spot] ? `#${PANE[spot]}` : null)} onSpot={(spot) => { if (spot === "chat") setChatOpen(true); else if (PANE[spot]) setPane(PANE[spot]); }} />
      <Sheet onClose={() => setChatOpen(false)} open={chatOpen} title="Pool chat"><PoolChat onHide={() => setChatOpen(false)} /></Sheet>
      {room.ticket ? <Ticket lamps={room.ticket.lamps} line={room.ticket.line} onOpen={() => setPane("slate")} week={room.feed.week} /> : null}
      {pane ? <section aria-label={TITLE[pane]} className="clubhouse-pane" style={{ top }}>
        <header className="lab-room-bar">
          <button className="lab-room-back" onClick={() => setPane(null)} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{TITLE[pane]}</h3>
        </header>
        {pane === "rules" ? <div className="clubhouse-page is-rules"><Constitution /></div> : (() => { const Page = PAGES[pane]; return <Page />; })()}
      </section> : null}
    </main>
  );
}
