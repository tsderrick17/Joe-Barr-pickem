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
  const [optedIn, setOptedIn] = useState(false);
  const [selections, setSelections] = useState<Record<string, "favorite" | "underdog">>({});
  const [savedSelections, setSavedSelections] = useState<Record<string, "favorite" | "underdog">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const hasUnsavedChanges = JSON.stringify(selections) !== JSON.stringify(savedSelections);
  function chooseTeam(gameId: string, side: "favorite" | "underdog") {
    setSelections((current) => current[gameId] === side
      ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== gameId))
      : { ...current, [gameId]: side });
  }
  async function submitSelections() {
    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setSavedSelections(selections);
    setIsSubmitting(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mt-2 font-serif text-4xl font-bold text-slate-950">NCAA Bowls</h1>
      {isLoading ? <p className="mt-4 text-slate-700">Loading Bowl Pool access…</p> : null}
      {!isLoading && !canView ? <p className="mt-4 text-slate-700">The NCAA Bowl Pool opens December 7 at 3:00 AM Eastern.</p> : null}
      {!isLoading && canView ? (
        <>
          <label className="mt-6 flex items-start gap-3 border border-slate-300 bg-white p-4 sm:p-5"><input className="mt-1 h-5 w-5" type="checkbox" checked={optedIn} onChange={(event) => setOptedIn(event.target.checked)} /><span className="text-sm text-slate-700">I would like to participate in the NCAA Bowl Pool (you can opt out at any time)</span></label>
          {optedIn && hasUnsavedChanges ? <section className="slate-mini-nav slate-receipt-strip is-pickem-only" aria-label="Bowl Pool submission"><div className="slate-receipt-ticket"><button className="slate-receipt-print needs-attention" disabled={isSubmitting} onClick={() => void submitSelections()} type="button">{isSubmitting ? "SUBMITTING…" : "SUBMIT"}</button></div></section> : null}
          {optedIn ? <section className="mt-4 border border-slate-300 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="mt-1 font-serif text-2xl font-bold">2026–27 Bowl Pool</h2>
            </div>
          </div>
          <div className="mt-5 overflow-hidden border border-slate-300">
            <div className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 sm:px-4">
              <span>Date / time</span><span>Bowl / location</span><span>Favorite</span><span className="text-center">Line</span><span>Underdog</span>
            </div>
            {!optedIn ? <div className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600">Check the box above to view the bowl schedule and participate.</div> : (games.length ? games : Array.from({ length: 5 }, (_, index) => ({ id: `blank-${index}`, bowl_name: "", kickoff_at: "", venue_city: undefined, venue_state: undefined, time_confirmed: true }))).map((game) => (
              <div className="grid min-h-16 grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] items-center gap-x-3 border-t border-slate-200 px-3 text-slate-400 sm:px-4" key={game.id}>
                <span className="text-xs leading-5">{game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "Date TBD"}<br />{game.time_confirmed === false ? "Time TBD" : game.kickoff_at ? `${new Date(game.kickoff_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : ""}</span>
                <span><strong className="block text-sm text-slate-700">{game.bowl_name || "Bowl game"}</strong><small>{game.venue_city && game.venue_state ? `${game.venue_city}, ${game.venue_state}` : "Location TBD"}</small></span>
                <button className={`text-left text-sm ${selections[game.id] === "favorite" ? "bowl-placeholder" : ""}`} aria-label="Select favorite team" onClick={() => chooseTeam(game.id, "favorite")} type="button">Team TBD</button>
                <span className="text-center" aria-label="Blank spread">—</span>
                <button className={`text-left text-sm ${selections[game.id] === "underdog" ? "bowl-placeholder" : ""}`} aria-label="Select underdog team" onClick={() => chooseTeam(game.id, "underdog")} type="button">Team TBD</button>
              </div>
            ))}
          </div>
        </section> : null}
        </>
      ) : null}
    </main>
  );
}
