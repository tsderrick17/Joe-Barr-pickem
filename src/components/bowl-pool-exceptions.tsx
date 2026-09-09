"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type BowlExceptionGame = { id: string; bowlName: string; kickoffAt: string; status: string; awayTeam: string; homeTeam: string };

export default function BowlPoolExceptions() {
  const [recordableGames, setRecordableGames] = useState<BowlExceptionGame[]>([]);
  const [exceptions, setExceptions] = useState<BowlExceptionGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetchWithSession("/api/admin/bowl-pool/exceptions");
    const data = await response.json() as { recordableGames?: BowlExceptionGame[]; exceptions?: BowlExceptionGame[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Bowl Pool exceptions could not be loaded.");
    setRecordableGames(data.recordableGames ?? []); setExceptions(data.exceptions ?? []);
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

  return <section className="border-b-2 border-zinc-900 py-8" id="bowl-pool-exceptions"><h2 className="font-serif text-2xl font-bold">Bowl Pool exceptions</h2><p className="mt-2 text-zinc-700">Record a verified Bowl postponement, cancellation, or no contest. Postponed games keep their picks; cancelled and no-contest picks are voided and audited.</p>{error ? <p className="mt-3 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-3 font-semibold text-green-800">{message}</p> : null}{recordableGames.length ? <div className="mt-5 flex flex-wrap items-center gap-3"><select className="min-w-64 border border-zinc-900 bg-white px-3 py-2" value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}><option value="">Choose a Bowl Pool game</option>{recordableGames.map((game) => <option key={game.id} value={game.id}>{game.bowlName} · {game.awayTeam} at {game.homeTeam}</option>)}</select><button className="border border-amber-800 px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-40" disabled={!selectedGameId || busy} onClick={() => void record("postponed")} type="button">Postponed</button><button className="bg-red-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={!selectedGameId || busy} onClick={() => void record("cancelled")} type="button">Cancelled</button><button className="border border-red-800 px-3 py-2 text-sm font-bold text-red-900 disabled:opacity-40" disabled={!selectedGameId || busy} onClick={() => void record("no_contest")} type="button">No contest</button></div> : null}{exceptions.length ? <ul className="mt-5 space-y-2">{exceptions.map((game) => <li className="border border-amber-800 bg-amber-50 p-3 text-sm" key={game.id}><b className="uppercase">{game.status.replace("_", " ")}</b> · {game.bowlName} · {game.awayTeam} at {game.homeTeam}</li>)}</ul> : null}</section>;
}
