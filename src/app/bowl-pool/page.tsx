"use client";

import { useEffect, useState } from "react";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { fetchWithSession } from "@/lib/auth-session";
import { CURRENT_SEASON_YEAR } from "@/lib/season";

type Profile = { isCommissioner?: boolean };
type BowlGame = {
  id: string;
  bowl_name: string;
  kickoff_at: string;
  line_lock_at?: string;
  venue_city?: string;
  venue_state?: string;
  time_confirmed?: boolean;
  away_team_id?: string;
  home_team_id?: string;
  awayTeam?: { id: string; full_name: string } | null;
  homeTeam?: { id: string; full_name: string } | null;
  line?: { favorite_team_id?: string | null; locked_spread?: number | string } | null;
};

export default function BowlPoolPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [selections, setSelections] = useState<Record<string, "favorite" | "underdog">>({});
  const [savedSelections, setSavedSelections] = useState<Record<string, "favorite" | "underdog">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [games, setGames] = useState<BowlGame[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasLaunched(Date.now() >= Date.parse(bowlPoolLaunchAt(CURRENT_SEASON_YEAR)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!profile || (!profile.isCommissioner && !hasLaunched)) return;
    void fetchWithSession("/api/bowl-pool").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { games?: BowlGame[]; optedIn?: boolean; ownPicks?: Array<{ game_id: string; selected_team_id: string }> };
      const nextGames = payload.games ?? [];
      setGames(nextGames);
      if (payload.optedIn !== undefined) setOptedIn(payload.optedIn);
      if (payload.ownPicks) {
        const next = Object.fromEntries(payload.ownPicks.flatMap((pick) => {
          const game = nextGames.find((candidate) => candidate.id === pick.game_id);
          if (!game) return [];
          const favoriteId = game.line?.favorite_team_id;
          const awayId = game.away_team_id ?? game.awayTeam?.id;
          const side = pick.selected_team_id === (favoriteId ?? awayId) ? "favorite" : "underdog";
          return [[pick.game_id, side as "favorite" | "underdog"]];
        }));
        setSelections(next);
        setSavedSelections(next);
      }
    }).catch(() => undefined);
  }, [profile, hasLaunched]);

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
    try {
      const selectionsToSave = Object.entries(selections).map(([gameId, side]) => {
        const game = games.find((candidate) => candidate.id === gameId);
        return { gameId, teamId: game ? (teamForSide(game, side)?.id ?? "") : "" };
      }).filter((selection): selection is { gameId: string; teamId: string } => Boolean(selection.teamId));
      const response = await fetchWithSession("/api/bowl-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optedIn: true, selections: selectionsToSave }) });
      if (!response.ok) throw new Error("Your Bowl Pool selections could not be saved.");
      setSavedSelections(selections);
    } finally { setIsSubmitting(false); }
  }

  async function changeOptIn(nextOptedIn: boolean) {
    setOptedIn(nextOptedIn);
    try {
      const response = await fetchWithSession("/api/bowl-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optedIn: nextOptedIn, selections: [] }) });
      if (!response.ok) setOptedIn(!nextOptedIn);
    } catch { setOptedIn(!nextOptedIn); }
  }

  function teamForSide(game: BowlGame, side: "favorite" | "underdog") {
    const favoriteId = game.line?.favorite_team_id;
    const awayId = game.away_team_id ?? game.awayTeam?.id;
    const homeId = game.home_team_id ?? game.homeTeam?.id;
    const selectedId = side === "favorite" ? (favoriteId ?? awayId) : (favoriteId === awayId ? homeId : awayId);
    return selectedId === awayId ? game.awayTeam : game.homeTeam;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mt-2 font-serif text-4xl font-bold text-slate-950">NCAA Bowls</h1>
      {isLoading ? <p className="mt-4 text-slate-700">Loading Bowl Pool access…</p> : null}
      {!isLoading && !canView ? <p className="mt-4 text-slate-700">The NCAA Bowl Pool opens December 7 at 3:00 AM Eastern.</p> : null}
      {!isLoading && canView ? (
        <>
          <label className="mt-6 flex items-center justify-center gap-3 border border-slate-300 bg-white p-4 text-center sm:p-5"><input className="h-5 w-5 shrink-0" type="checkbox" checked={optedIn} onChange={(event) => void changeOptIn(event.target.checked)} /><span className="font-bold text-sm text-slate-700">I would like to participate in the NCAA Bowl Pool (you can opt out prior to first kickoff)</span></label>
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
            {!optedIn ? <div className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600">Check the box above to view the bowl schedule and participate.</div> : (games.length ? games : [{ id: "frisco-placeholder", bowl_name: "Frisco", kickoff_at: "", venue_city: "Frisco", venue_state: "TX", time_confirmed: true }]).map((game, index) => (
              <div className={`grid min-h-16 grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] items-center gap-x-3 border-t border-slate-200 px-3 text-slate-400 sm:px-4 ${index % 2 ? "bg-slate-100" : "bg-white"}`} key={game.id}>
                <span className="text-xs leading-5">{game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "Date TBD"}<br />{game.time_confirmed === false ? "Time TBD" : game.kickoff_at ? `${new Date(game.kickoff_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : ""}</span>
                <span><strong className="block text-sm text-slate-700">{game.bowl_name || "Bowl game"}</strong><small>{game.venue_city && game.venue_state ? `${game.venue_city}, ${game.venue_state}` : "Location TBD"}</small></span>
                <button className={`text-left text-sm ${selections[game.id] === "favorite" ? "bowl-placeholder" : ""}`} aria-label="Select favorite team" onClick={() => chooseTeam(game.id, "favorite")} type="button">{teamForSide(game, "favorite")?.full_name || "Team TBD"}</button>
                <span className="text-center" aria-label="Blank spread">{game.line?.locked_spread ?? "—"}</span>
                <button className={`text-left text-sm ${selections[game.id] === "underdog" ? "bowl-placeholder" : ""}`} aria-label="Select underdog team" onClick={() => chooseTeam(game.id, "underdog")} type="button">{teamForSide(game, "underdog")?.full_name || "Team TBD"}</button>
              </div>
            ))}
          </div>
        </section> : null}
        </>
      ) : null}
    </main>
  );
}
