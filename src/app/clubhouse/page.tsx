"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PoolChat from "@/components/pool-chat";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { RoomScene, Ticket, type RoomFeed } from "@/components/lab/lab-clubhouse";
import type { LampState } from "@/components/lab/lab-tote";
import { FootballLoadingScreen } from "@/components/football-loader";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import type { SlateResponse, StandingsResponse } from "@/lib/api-contracts";
import { clubhouseFeed } from "@/lib/clubhouse-feed.js";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";

/** Where each thing in the room takes you: the real pages, exactly as they are. */
const HREF: Record<string, string> = {
  sportsbook: "/board",
  picks: "/board",
  board: "/",
  survivor: "/survivor",
  trophies: "/trophy-room",
  bowl: "/bowl-pool",
  chat: "#chat",
  constitution: "/clubhouse/rules",
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
    <main aria-label="Clubhouse" className="clubhouse-page">
      <RoomScene feed={room.feed} full hrefFor={(spot) => HREF[spot] ?? null} onSpot={(spot) => { if (spot === "chat") setChatOpen(true); }} />
      <Sheet onClose={() => setChatOpen(false)} open={chatOpen} title="Pool chat"><PoolChat onHide={() => setChatOpen(false)} /></Sheet>
      {room.ticket ? <Ticket href="/board" lamps={room.ticket.lamps} line={room.ticket.line} week={room.feed.week} /> : null}
    </main>
  );
}
