"use client";

import { useCallback, useEffect, useState } from "react";
import { BowlClaimSeat } from "@/components/bowl-pool-marks";
import { BowlTicketCard } from "@/components/bowl-ticket";
import ForfeitPanel from "@/components/forfeit-panel";
import PoolChat, { type Message as ChatMessage } from "@/components/pool-chat";
import { RealTrophyRoom } from "@/components/lab/lab-clubhouse";
import { TicketForm, ToteBoard, type Ticket } from "@/components/lab/lab-tote";
import SurvivorToteBoard from "@/components/lab/lab-survivor-tote";
import type { StandingsResponse } from "@/lib/api-contracts";
import { PICKS_SAVED_EVENT } from "@/lib/app-badge.js";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import type { BoardView } from "@/lib/board-view.js";
import { haptic } from "@/lib/haptics-client";
import { buildSlateSubmission } from "@/lib/slate-submission.js";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { bowlTeamForSide, bowlTicketView, type BowlSide } from "@/lib/bowl-ticket-view.js";
import { dateFormat } from "@/lib/date-format.js";
import { currentSeasonYear } from "@/lib/season";

/**
 * The clubhouse's pop-ups: the new views, on the pool's real data. The same pieces the Lab shows with sample players, drawn from the
 * Standings' and the Slate's own reads (see board-view.js), so they can never show more than the classic pages do.
 */

const PICK_SAVE_TIMEOUT_MS = 30_000;

/** The Big Board: everyone's picks this week, and the bar that opens your ticket. */
export function BoardPopup({ view, onOpenTicket, onWeek }: { view: BoardView; onOpenTicket: () => void; onWeek: (weekId: string) => void }) {
  return <ToteBoard onOpen={onOpenTicket} onWeek={onWeek} view={view} />;
}

export type DeckTab = { pane: string; label: string };
/**
 * The clubhouse board's switch, always on top of it: Big Board, your Ticket, and Survivor (or, once Survivor is decided and the bowls are
 * on, the Bowl Pool). Each tab is its own address, so the phone's back gesture still closes the board.
 */
export function DeckTabs({ tabs, current, onChoose }: { tabs: DeckTab[]; current: string; onChoose: (pane: string) => void }) {
  return (
    <nav aria-label="Board" className="club-deck-tabs" style={{ ["--tabs" as string]: tabs.length }}>
      {tabs.map((tab) => <button aria-current={tab.pane === current ? "page" : undefined} key={tab.pane} onClick={() => { if (tab.pane !== current) onChoose(tab.pane); }} type="button">{tab.label}</button>)}
    </nav>
  );
}

/**
 * Your ticket, the middle tab of the clubhouse's board: sends the very same POST the Slate makes. Always there to look at, every week: once
 * every game has kicked off it is the week's ticket as it stands, nothing left to change.
 */
export function TicketPanel({ view, onSent, onChanged, onWeek, startOn = "pickem" }: { view: BoardView; onSent: () => void; onChanged: () => Promise<void>; onWeek?: (weekId: string) => void; startOn?: "pickem" | "survivor" }) {
  // All games / Pool action is the Slate's own choice, saved to the same place (the profile), and kept while the clubhouse is open.
  const [actionOnly, setActionOnly] = useState<boolean | null>(null);
  const poolAction = actionOnly ?? view.poolAction;
  function choosePoolAction(next: boolean) {
    const before = poolAction;
    setActionOnly(next);
    void fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showPoolAction: next }) })
      .then((response) => { if (!response.ok) throw new Error(); })
      .catch(() => setActionOnly(before));
  }

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
      onSent();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) { window.location.replace("/login"); return ""; }
      haptic("warning");
      return "Your picks are taking too long to save. Please try again.";
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <>
      <TicketForm key={`${view.weekId ?? ""}-${startOn}`} onPoolAction={choosePoolAction} onSubmit={submit} onWeek={onWeek} poolAction={poolAction} startOn={startOn} view={view} />
      {/* In the playoffs, Forfeit sits at the very foot of the ticket, as on the Slate: three questions, and only the last one acts. */}
      {view.playoff?.you.forfeitAvailable ? <ForfeitPanel /> : null}
    </>
  );
}

/**
 * The Survivor table, the Standings' own rows, in the Big Board's housing with the same two tabs. Always the whole table: this view has no
 * show/hide switches, so a player's own display choices never blank it.
 */
export function SurvivorPopup({ home, onBoard, onPick }: { home: StandingsResponse; onBoard?: () => void; onPick?: () => void }) {
  return <SurvivorToteBoard home={home} onBoard={onBoard} onPick={onPick} />;
}

type Season = Parameters<typeof RealTrophyRoom>[0]["trophies"][number];
type Player = Parameters<typeof RealTrophyRoom>[0]["players"][number];

/** The Trophy Room: the trophies, a plaque for every season, and the all-time records, from the Trophy Room's own read. */
// The Trophy Room's and the chat's last reads, kept while the clubhouse is open: the room reads them ahead so each sheet opens already
// full and slides up whole, instead of opening on a line of "Loading" and snapping to its height. Each is read again when it opens.
let lastTrophyRead: { trophies: Season[]; players: Player[] } | null = null;
let lastChatRead: ChatMessage[] | null = null;
export async function prefetchTrophyRoom() {
  try {
    const response = await fetchWithSession("/api/trophy-room");
    if (response.ok) { const body = await response.json() as { trophies?: Season[]; players?: Player[] }; lastTrophyRead = { trophies: body.trophies ?? [], players: body.players ?? [] }; }
  } catch { /* the Trophy Room reads it again when it opens */ }
}
export async function prefetchPoolChat() {
  try {
    const response = await fetchWithSession("/api/pool-chat");
    if (response.ok) lastChatRead = (await response.json() as { messages?: ChatMessage[] }).messages ?? [];
  } catch { /* the chat reads it again when it opens */ }
}

/** The pool chat in the clubhouse: the chat itself, in the Big Board's green-and-gold housing. */
export function ClubChat({ onHide }: { onHide: () => void }) {
  return (
    <div className="lab-tote club-chat">
      <header><h3>POOL CHAT</h3></header>
      <PoolChat initialMessages={lastChatRead} onHide={onHide} />
    </div>
  );
}

export function TrophyPopup() {
  const [data, setData] = useState<{ trophies: Season[]; players: Player[] } | null>(lastTrophyRead);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const response = await fetchWithSession("/api/trophy-room");
        const body = await response.json() as { trophies?: Season[]; players?: Player[]; error?: string };
        if (response.status === 404) { if (!disposed) setMessage("The Trophy Room is not open yet."); return; }
        if (!response.ok) throw new Error(body.error ?? "The Trophy Room could not be loaded.");
        lastTrophyRead = { trophies: body.trophies ?? [], players: body.players ?? [] };
        if (!disposed) setData(lastTrophyRead);
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

/**
 * The Bowl Pool as the Bowl ticket (src/components/bowl-ticket.tsx), from the Bowl Pool's own read; picks, the tiebreaker, claiming a seat
 * and opting out send the very same POST the classic Bowl Pool page makes. Before the pool opens to players it says when it opens.
 */
// The last Bowl Pool read, kept while the clubhouse is open: the room reads it ahead (prefetchBowlPool) so the ticket opens already full,
// sliding up whole instead of opening on a line of "Loading" and snapping to its height. It is read again every time the ticket opens.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Bowl Pool's read, as the classic page takes it
let lastBowlRead: any = null;
// It also feeds the room's ticker its bowls, so it hands the read back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Bowl Pool's read, as the classic page takes it
export async function prefetchBowlPool(): Promise<any> {
  try {
    const response = await fetchWithSession("/api/bowl-pool", { cache: "no-store" });
    if (response.ok) lastBowlRead = await response.json();
  } catch { /* the ticket reads it again when it opens */ }
  return lastBowlRead;
}

export function BowlPopup({ viewerPlayerId }: { viewerPlayerId: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Bowl Pool's read, as the classic page takes it
  const [payload, setPayload] = useState<any>(lastBowlRead);
  const [reads, setReads] = useState(0);
  const [message, setMessage] = useState("");
  const [claiming, setClaiming] = useState(false);

  const [asked, setAsked] = useState(0);   // bumped to read the Bowl Pool again (after a save, a claim or an opt-out)
  const load = useCallback(() => setAsked((count) => count + 1), []);
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const response = await fetchWithSession("/api/bowl-pool", { cache: "no-store" });
        if (response.status === 404) {
          const opens = dateFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric" }).format(new Date(bowlPoolLaunchAt(currentSeasonYear())));
          if (!disposed) setMessage(`The Bowl Pool opens ${opens}.`);
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "The Bowl Pool could not be loaded.");
        if (disposed) return;
        lastBowlRead = body;
        setPayload(body);
        setReads((count) => count + 1);
        setMessage("");
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setMessage(reason instanceof Error ? reason.message : "The Bowl Pool could not be loaded.");
      }
    })();
    return () => { disposed = true; };
  }, [asked]);

  async function send(body: object) {
    const response = await fetchWithSession("/api/bowl-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(data?.error ?? "Your Bowl Pool selections could not be saved.");
  }

  async function save(picks: Record<string, BowlSide>, guess: string): Promise<string | void> {
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a game of the Bowl Pool's read
    const selections = (payload?.games ?? []).flatMap((game: any) => {
      const side = picks[game.id];
      const open = game.kickoff_at && now < Date.parse(game.kickoff_at) && !["postponed", "cancelled", "no_contest"].includes(game.status ?? "");
      return side && open ? [{ gameId: game.id, teamId: bowlTeamForSide(game, side).id ?? "", side }] : [];
    });
    try {
      await send({ optedIn: true, selections, championshipTotalGuess: guess.trim() === "" ? null : Number(guess) });
      haptic("success");
      load();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) { window.location.replace("/login"); return ""; }
      haptic("warning");
      return reason instanceof Error ? reason.message : "Your Bowl Pool selections could not be saved.";
    }
  }

  async function claim() {
    setClaiming(true);
    try { await send({ optedIn: true, selections: [], championshipTotalGuess: null }); haptic("success"); load(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Your seat could not be claimed."); }
    finally { setClaiming(false); }
  }

  async function optOut() {
    if (!window.confirm("Give up your seat in the Bowl Pool? You can claim it again until the first bowl kicks off.")) return;
    try { await send({ optedIn: false, selections: [], championshipTotalGuess: null }); load(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Your opt-out could not be saved."); }
  }

  if (message && !payload) return <p className="lab-board-note" role="alert">{message}</p>;
  if (!payload) return <p className="lab-board-note">Loading the Bowl Pool…</p>;
  const view = bowlTicketView(payload, { viewerPlayerId });
  if (!view.optedIn) {
    return view.entryOpen
      ? <BowlClaimSeat busy={claiming} onClaim={() => void claim()} />
      : <p className="lab-board-note">Bowl Pool entry closed at the first kickoff. Check back next year.</p>;
  }
  return <BowlTicketCard key={reads} onOptOut={() => void optOut()} onSave={save} view={view} />;
}
