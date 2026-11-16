"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { RealTrophyRoom } from "@/components/lab/lab-clubhouse";
import { TicketForm, ToteBoard, type Ticket } from "@/components/lab/lab-tote";
import SurvivorTable from "@/components/survivor-table";
import type { StandingsResponse } from "@/lib/api-contracts";
import { PICKS_SAVED_EVENT } from "@/lib/app-badge.js";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import type { BoardView } from "@/lib/board-view.js";
import { haptic } from "@/lib/haptics-client";
import { buildSlateSubmission } from "@/lib/slate-submission.js";

/**
 * The clubhouse's pop-ups: the new views, on the pool's real data. The same pieces the Lab shows with sample players, drawn from the
 * Standings' and the Slate's own reads (see board-view.js), so they can never show more than the classic pages do.
 */

const PICK_SAVE_TIMEOUT_MS = 30_000;

/** The Big Board: everyone's picks this week, and the bar that opens your ticket. */
export function BoardPopup({ view, home, onOpenTicket, onSurvivor }: { view: BoardView; home: StandingsResponse; onOpenTicket: () => void; onSurvivor: () => void }) {
  return <ToteBoard onOpen={onOpenTicket} onSurvivor={home.survivorAvailable ? onSurvivor : undefined} view={view} />;
}

/**
 * Your ticket: sends the very same POST the Slate makes. It stands beside the board's sheet, not inside it (a sheet inside a sheet is drawn
 * under its parent's scrolling body), and after the board's own in the page, so it opens on top of it.
 */
export function TicketPopup({ view, open, onClose, onChanged }: { view: BoardView; open: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  async function submit(ticket: Ticket): Promise<string | void> {
    if (!view.weekId) return "This week could not be found. Please close the board and try again.";
    const find = (team: string) => ({ gameId: view.ids[team].gameId, teamId: view.ids[team].teamId });
    const request = new AbortController();
    const timer = window.setTimeout(() => request.abort(), PICK_SAVE_TIMEOUT_MS);
    try {
      const response = await fetchWithSession("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSlateSubmission({
          scoringPeriodId: view.weekId,
          selections: ticket.picks.map(find),
          survivorAvailable: view.survivor.playing,
          survivorHasUnsavedChanges: view.survivor.playing && ticket.survivor !== view.mine.survivor,
          survivorPick: ticket.survivor ? find(ticket.survivor) : null,
        })),
        signal: request.signal,
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { haptic("warning"); return data.error ?? "Your picks could not be saved. Please try again."; }
      haptic("success");
      window.dispatchEvent(new Event(PICKS_SAVED_EVENT));
      await onChanged();   // the board and the room's ticket read again, so the pick shows at once
      onClose();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) { window.location.replace("/login"); return ""; }
      haptic("warning");
      return "Your picks are taking too long to save. Please try again.";
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <Sheet bare onClose={onClose} open={open && view.canPick} title="Your ticket">
      <TicketForm onSubmit={submit} view={view} />
    </Sheet>
  );
}

/** The Survivor table, as the Standings shows it. */
export function SurvivorPopup({ home }: { home: StandingsResponse }) {
  // Always the whole table: this view has no show/hide switches, so a player's own display choices never blank it.
  const shown = { ...home, showSurvivorStandings: true, hideSurvivorEliminatedRows: false };
  if (!home.survivorAvailable) return <p>Survivor is not running right now.</p>;
  return <SurvivorTable data={shown} displayLocked savingDisplay={false} setEliminatedRowsHidden={() => {}} setSurvivorDisplay={() => {}} />;
}

type Season = Parameters<typeof RealTrophyRoom>[0]["trophies"][number];
type Player = Parameters<typeof RealTrophyRoom>[0]["players"][number];

/** The Trophy Room: the trophies, a plaque for every season, and the all-time records, from the Trophy Room's own read. */
export function TrophyPopup() {
  const [data, setData] = useState<{ trophies: Season[]; players: Player[] } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const response = await fetchWithSession("/api/trophy-room");
        const body = await response.json() as { trophies?: Season[]; players?: Player[]; error?: string };
        if (response.status === 404) { if (!disposed) setMessage("The Trophy Room is not open yet."); return; }
        if (!response.ok) throw new Error(body.error ?? "The Trophy Room could not be loaded.");
        if (!disposed) setData({ trophies: body.trophies ?? [], players: body.players ?? [] });
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setMessage(reason instanceof Error ? reason.message : "The Trophy Room could not be loaded.");
      }
    })();
    return () => { disposed = true; };
  }, []);
  if (message) return <p role="alert">{message}</p>;
  if (!data) return <p>Loading the Trophy Room…</p>;
  return <RealTrophyRoom players={data.players} trophies={data.trophies} />;
}
