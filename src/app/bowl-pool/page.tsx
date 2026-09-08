"use client";

import { useEffect, useState } from "react";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { fetchWithSession } from "@/lib/auth-session";
import { CURRENT_SEASON_YEAR } from "@/lib/season";

type Profile = { isCommissioner?: boolean };

export default function BowlPoolPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [csv, setCsv] = useState("order,bowl_name,kickoff_at,game_key,away_team,home_team,spread,is_cfp\n");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [games, setGames] = useState<Array<{ id: string; bowl_name: string; kickoff_at: string; venue_city?: string; venue_state?: string; time_confirmed?: boolean }>>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasLaunched(Date.now() >= Date.parse(bowlPoolLaunchAt(CURRENT_SEASON_YEAR)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!profile?.isCommissioner || hasLaunched) return;
    void fetchWithSession(`/api/admin/bowl-pool/schedule?seasonYear=${CURRENT_SEASON_YEAR}`).then(async (response) => {
      if (response.ok) setGames(((await response.json()) as { games?: typeof games }).games ?? []);
    }).catch(() => undefined);
  }, [profile?.isCommissioner, hasLaunched]);

  useEffect(() => {
    let active = true;
    void fetchWithSession("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile could not be loaded.");
        return response.json() as Promise<Profile>;
      })
      .then((nextProfile) => { if (active) setProfile(nextProfile); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const canView = profile?.isCommissioner === true || hasLaunched;
  async function importSchedule() {
    setImporting(true); setImportMessage(null);
    try {
      const response = await fetchWithSession("/api/admin/bowl-pool/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seasonYear: CURRENT_SEASON_YEAR, csv }) });
      const result = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setImportMessage(`${result.imported ?? 0} schedule rows staged. Team names and lines can be filled in later.`);
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Import failed."); }
    finally { setImporting(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Separate competition</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-slate-950">NCAA Bowls</h1>
      {isLoading ? <p className="mt-4 text-slate-700">Loading Bowl Pool access…</p> : null}
      {!isLoading && !canView ? <p className="mt-4 text-slate-700">The NCAA Bowl Pool opens December 7 at 3:00 AM Eastern.</p> : null}
      {!isLoading && canView ? (
        <section className="mt-6 border border-slate-300 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Selections card</p>
              <h2 className="mt-1 font-serif text-2xl font-bold">2026–27 Bowl Pool</h2>
            </div>
            <span className="border border-slate-300 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Preview</span>
          </div>
          <p className="mt-4 max-w-2xl text-slate-700">Every bowl and playoff matchup will appear here in chronological order. Team names and spreads are intentionally blank until the schedule and lines are confirmed.</p>
          <label className="mt-5 flex items-start gap-3 border border-slate-300 bg-slate-50 p-4"><input className="mt-1 h-5 w-5" type="checkbox" checked={optedIn} onChange={(event) => setOptedIn(event.target.checked)} /><span><strong className="block text-sm">Opt in to the NCAA Bowl Pool</strong><span className="text-sm text-slate-600">I want to make one ATS selection for every bowl and playoff matchup. You can opt out until the first kickoff.</span></span></label>
          {profile?.isCommissioner && !hasLaunched ? <div className="mt-5 border border-slate-300 bg-slate-50 p-4"><p className="text-sm font-bold">Stage the schedule</p><p className="mt-1 text-sm text-slate-600">Paste CSV rows in order. Use the sponsor-free name you want displayed; teams and spreads may stay blank.</p><textarea className="mt-3 min-h-32 w-full border border-slate-300 bg-white p-3 font-mono text-xs" value={csv} onChange={(event) => setCsv(event.target.value)} aria-label="Bowl schedule CSV" /><button type="button" className="mt-3 border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={importing} onClick={() => void importSchedule()}>{importing ? "Staging…" : "Stage schedule"}</button>{importMessage ? <p className="mt-2 text-sm text-slate-700" role="status">{importMessage}</p> : null}</div> : null}
          <div className="mt-5 overflow-hidden border border-slate-300">
            <div className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 sm:px-4">
              <span>Date / time</span><span>Bowl / location</span><span>Favorite</span><span className="text-center">Line</span><span>Underdog</span>
            </div>
            {(games.length ? games : Array.from({ length: 5 }, (_, index) => ({ id: `blank-${index}`, bowl_name: "", kickoff_at: "", venue_city: undefined, venue_state: undefined, time_confirmed: true }))).map((game) => (
              <div className="grid min-h-16 grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] items-center gap-x-3 border-t border-slate-200 px-3 text-slate-400 sm:px-4" key={game.id}>
                <span className="text-xs leading-5">{game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "Date TBD"}<br />{game.time_confirmed === false ? "Time TBD" : game.kickoff_at ? `${new Date(game.kickoff_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : ""}</span>
                <span><strong className="block text-sm text-slate-700">{game.bowl_name || "Bowl game"}</strong><small>{game.venue_city && game.venue_state ? `${game.venue_city}, ${game.venue_state}` : "Location TBD"}</small></span>
                <span className="text-sm" aria-label="Blank favorite team">TBD</span>
                <span className="text-center" aria-label="Blank spread">—</span>
                <span className="text-sm" aria-label="Blank underdog team">TBD</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Commissioner preview only. The live schedule importer will replace these blank rows without changing the Bowl Pool rules or NFL picks.</p>
          <div className="mt-6 border border-slate-300 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Standings card</p><h3 className="mt-1 font-serif text-xl font-bold">Bowl Pool standings</h3><p className="mt-2 text-sm text-slate-600">No entries yet. Once players opt in, this responsive card will list every participant, wins, and final-game tiebreaker. It remains commissioner-only until launch.</p></div>
          {profile?.isCommissioner && !hasLaunched ? <p className="mt-4 text-sm font-semibold text-slate-600">Commissioner preview · player access opens December 7 at 3:00 AM Eastern.</p> : null}
        </section>
      ) : null}
    </main>
  );
}
