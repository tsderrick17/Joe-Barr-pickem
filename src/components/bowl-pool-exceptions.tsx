"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { easternKickoffIso } from "@/lib/bowl-commissioner-input.js";
import { dateFormat } from "@/lib/date-format.js";

type BowlExceptionGame = { id: string; bowlName: string; kickoffAt: string; status: string; awayTeam: string; homeTeam: string };
type BowlScheduleChange = { id: string; game_id: string; old_kickoff_at: string | null; new_kickoff_at: string | null; reason: string | null; detected_at: string };

export default function BowlPoolExceptions() {
  const [recordableGames, setRecordableGames] = useState<BowlExceptionGame[]>([]);
  const [exceptions, setExceptions] = useState<BowlExceptionGame[]>([]);
  const [scheduleChanges, setScheduleChanges] = useState<BowlScheduleChange[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moves, setMoves] = useState<Record<string, { date: string; time: string }>>({});

  async function load() {
    const response = await fetchWithSession("/api/admin/bowl-pool/exceptions");
    const data = await response.json() as { recordableGames?: BowlExceptionGame[]; exceptions?: BowlExceptionGame[]; scheduleChanges?: BowlScheduleChange[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Bowl Pool exceptions could not be loaded.");
    setRecordableGames(data.recordableGames ?? []); setExceptions(data.exceptions ?? []); setScheduleChanges(data.scheduleChanges ?? []);
  }

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try { await load(); }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Bowl Pool exceptions could not be loaded."); }
    }
    void loadInitial();
    return () => { active = false; };
  }, []);

  async function record(status: "postponed" | "cancelled" | "no_contest") {
    const game = recordableGames.find((candidate) => candidate.id === selectedGameId);
    if (!game || !window.confirm(`Record ${game.bowlName} as ${status.replace("_", " ")}?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/admin/bowl-pool/exceptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: game.id, status }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The Bowl Pool disruption could not be recorded.");
      setMessage(data.message ?? "Bowl Pool exception recorded."); setSelectedGameId(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The Bowl Pool disruption could not be recorded."); }
    finally { setBusy(false); }
  }

  /** A postponed game gets its new date and time (Eastern, like every Bowl kickoff): its picks are kept and its reminders are rebuilt for the new time. */
  async function reschedule(game: BowlExceptionGame) {
    const move = moves[game.id] ?? { date: "", time: "" };
    const kickoffAt = easternKickoffIso(move.date, move.time);
    if (!kickoffAt) { setError("Choose the new date and the new time (Eastern) first."); setMessage(""); return; }
    const label = dateFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(kickoffAt));
    if (!window.confirm(`Move ${game.bowlName} to ${label}? Its picks are kept.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/admin/bowl-pool/exceptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: game.id, status: "rescheduled", kickoffAt }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The game could not be rescheduled.");
      setMessage(data.message ?? "Bowl Pool game rescheduled."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The game could not be rescheduled."); }
    finally { setBusy(false); }
  }

  async function reviewChange(change: BowlScheduleChange) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/admin/bowl-pool/exceptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: change.game_id, status: "rescheduled", changeId: change.id }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The schedule change could not be reviewed.");
      setMessage(data.message ?? "Schedule change reviewed."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The schedule change could not be reviewed."); }
    finally { setBusy(false); }
  }

  return <section className="commissioner-tool" id="bowl-pool-exceptions"><h2 className="font-serif text-2xl font-bold">Bowl Pool exceptions</h2><p className="mt-2 text-(color:--themed-text-29)">Record a verified Bowl postponement, cancellation, or no contest. Postponed games keep their picks; cancelled and no-contest picks are voided and audited. When a postponed game gets its new date, set it here.</p>{error ? <p className="mt-3 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-3 font-semibold text-green-800">{message}</p> : null}{scheduleChanges.length ? <div className="mt-5 desk-status is-warn p-4"><h3 className="font-bold">Schedule changes awaiting review</h3><ul className="mt-2 space-y-2 text-sm">{scheduleChanges.map((change) => <li className="flex flex-wrap items-center justify-between gap-2" key={change.id}><span>{change.reason ?? `${new Date(change.old_kickoff_at ?? change.detected_at).toLocaleString()} → ${new Date(change.new_kickoff_at ?? change.detected_at).toLocaleString()}`}</span><button className="desk-button px-2 py-1 font-bold disabled:opacity-40" disabled={busy} onClick={() => void reviewChange(change)} type="button">Mark reviewed</button></li>)}</ul></div> : null}{recordableGames.length ? <div className="mt-5 flex flex-wrap items-center gap-3"><select className="min-w-64 desk-button px-3 py-2" value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}><option value="">Choose a Bowl Pool game</option>{recordableGames.map((game) => <option key={game.id} value={game.id}>{game.bowlName} · {game.awayTeam} at {game.homeTeam}</option>)}</select><button className="border border-(color:--themed-border-18) px-3 py-2 text-sm font-bold text-(color:--themed-text-23) disabled:opacity-40" disabled={!selectedGameId || busy} onClick={() => void record("postponed")} type="button">Postponed</button><button className="bg-(color:--fill-danger-solid) px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={!selectedGameId || busy} onClick={() => void record("cancelled")} type="button">Cancelled</button><button className="border border-(color:--themed-border-25) px-3 py-2 text-sm font-bold text-red-900 disabled:opacity-40" disabled={!selectedGameId || busy} onClick={() => void record("no_contest")} type="button">No contest</button></div> : null}{exceptions.length ? <ul className="mt-5 space-y-2">{exceptions.map((game) => <li className="desk-status is-warn p-3 text-sm" key={game.id}><b className="uppercase">{game.status.replace("_", " ")}</b> · {game.bowlName} · {game.awayTeam} at {game.homeTeam}{game.status === "postponed" ? <div className="mt-2 flex flex-wrap items-center gap-2"><input aria-label={`New date for ${game.bowlName}`} className="desk-input px-3 py-2" onChange={(event) => setMoves((current) => ({ ...current, [game.id]: { date: event.target.value, time: current[game.id]?.time ?? "" } }))} type="date" value={moves[game.id]?.date ?? ""} /><input aria-label={`New time for ${game.bowlName}, Eastern`} className="desk-input px-3 py-2" onChange={(event) => setMoves((current) => ({ ...current, [game.id]: { date: current[game.id]?.date ?? "", time: event.target.value } }))} type="time" value={moves[game.id]?.time ?? ""} /><span className="text-xs">Eastern time</span><button className="desk-button-solid px-3 py-2 text-sm font-bold disabled:opacity-40" disabled={busy} onClick={() => void reschedule(game)} type="button">Reschedule</button></div> : null}</li>)}</ul> : null}</section>;
}
