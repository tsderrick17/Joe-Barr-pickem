"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { dateFormat } from "@/lib/date-format.js";

type LineGame = { id: string; bowlName: string; kickoffAt: string; lineLockAt: string; status: string; away: { id: string; name: string }; home: { id: string; name: string } };
type Entry = { favorite: string; spread: string };

const PICKEM = "pickem";
const when = (iso: string) => dateFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(iso));

/** For a game the provider feeds gave no line: pick the favorite, type the spread, and it is the official line. */
export default function BowlPoolLines() {
  const [games, setGames] = useState<LineGame[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetchWithSession("/api/admin/bowl-pool/lines");
    const data = await response.json() as { games?: LineGame[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Bowl Pool lines could not be loaded.");
    setGames(data.games ?? []); setLoaded(true);
  }

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try { await load(); }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Bowl Pool lines could not be loaded."); }
    }
    void loadInitial();
    return () => { active = false; };
  }, []);

  const entryFor = (game: LineGame): Entry => entries[game.id] ?? { favorite: "", spread: "" };
  const change = (game: LineGame, next: Partial<Entry>) => setEntries((current) => ({ ...current, [game.id]: { ...entryFor(game), ...next } }));

  async function save(game: LineGame) {
    const entry = entryFor(game);
    const pickem = entry.favorite === PICKEM;
    const spread = pickem ? 0 : Number(entry.spread);
    if (!entry.favorite || (!pickem && (entry.spread.trim() === "" || !Number.isFinite(spread)))) { setError("Choose the favorite and type the spread, like 3.5."); setMessage(""); return; }
    const favoriteName = pickem ? null : entry.favorite === game.away.id ? game.away.name : game.home.name;
    const summary = favoriteName ? `${favoriteName} favored by ${spread}` : "a pick'em";
    if (!window.confirm(`Set ${game.bowlName} (${game.away.name} at ${game.home.name}) to ${summary}? It becomes the official line.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/admin/bowl-pool/lines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: game.id, favoriteTeamId: pickem ? null : entry.favorite, spread }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The line could not be saved.");
      setMessage(data.message ?? "Line saved."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The line could not be saved."); }
    finally { setBusy(false); }
  }

  return <section className="commissioner-tool" id="bowl-pool-lines" aria-labelledby="bowl-lines-title">
    <h2 className="font-serif text-2xl font-bold" id="bowl-lines-title">Bowl Pool lines</h2>
    <p className="mt-2 text-(color:--themed-text-29)">ESPN sets every line. A game shows here only if its line locks within a day, or it is over, and it still has none. Without a line a pick cannot be graded.</p>
    {error ? <p className="mt-3 font-semibold text-red-700">{error}</p> : null}
    {message ? <p className="mt-3 font-semibold text-green-800">{message}</p> : null}
    {loaded && !games.length && !error ? <p className="desk-status is-ok mt-4 p-3 text-sm">Every game that is due has its line.</p> : null}
    {games.length ? <ul className="mt-4 space-y-3">{games.map((game) => <li className="desk-status is-warn p-3 text-sm" key={game.id}>
      <b>{game.bowlName}</b> · {game.away.name} at {game.home.name}
      <br /><span className="text-(color:--themed-text-29)">{game.status === "final" ? "Final, waiting on a line to be graded" : `Line locks ${when(game.lineLockAt)} · kickoff ${when(game.kickoffAt)}`}</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select aria-label={`Favorite in ${game.bowlName}`} className="desk-button px-3 py-2" onChange={(event) => change(game, { favorite: event.target.value, ...(event.target.value === PICKEM ? { spread: "" } : {}) })} value={entryFor(game).favorite}>
          <option value="">Favorite</option>
          <option value={game.away.id}>{game.away.name}</option>
          <option value={game.home.id}>{game.home.name}</option>
          <option value={PICKEM}>No favorite (pick&apos;em)</option>
        </select>
        <input aria-label={`Spread in ${game.bowlName}`} className="desk-input w-28 px-3 py-2" disabled={entryFor(game).favorite === PICKEM} inputMode="decimal" onChange={(event) => change(game, { spread: event.target.value })} placeholder="e.g. 3.5" value={entryFor(game).spread} />
        <button className="desk-button-solid px-3 py-2 text-sm font-bold disabled:opacity-40" disabled={busy} onClick={() => void save(game)} type="button">Set line</button>
      </div>
    </li>)}</ul> : null}
  </section>;
}
