"use client";

import { useEffect, useState } from "react";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { bowlReceiptSummary, bowlSelectionsEqual } from "@/lib/bowl-receipt.js";
import { fetchWithSession } from "@/lib/auth-session";
import { CURRENT_SEASON_YEAR } from "@/lib/season";

type Profile = { isCommissioner?: boolean };
type BowlGame = {
  id: string;
  provider_game_id?: string;
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
  line?: { favorite_team_id?: string | null; locked_spread?: number | string; locked_at?: string | null } | null;
};

export default function BowlPoolPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [selections, setSelections] = useState<Record<string, "favorite" | "underdog">>({});
  const [savedSelections, setSavedSelections] = useState<Record<string, "favorite" | "underdog">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [championshipTotalGuess, setChampionshipTotalGuess] = useState("");
  const [savedChampionshipTotalGuess, setSavedChampionshipTotalGuess] = useState("");
  const [games, setGames] = useState<BowlGame[]>([]);
  const [championshipGameId, setChampionshipGameId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [submissionError, setSubmissionError] = useState("");
  const [selectionFeedback, setSelectionFeedback] = useState<{ gameId: string; side: "favorite" | "underdog"; token: number } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasLaunched(Date.now() >= Date.parse(bowlPoolLaunchAt(CURRENT_SEASON_YEAR)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!profile || (!profile.isCommissioner && !hasLaunched)) return;
    void fetchWithSession("/api/bowl-pool").then(async (response) => {
      if (!response.ok) { setOptedIn(false); return; }
      const payload = await response.json() as { games?: BowlGame[]; season?: { championship_game_id?: string | null }; optedIn?: boolean; entry?: { championship_total_guess?: number | null } | null; ownPicks?: Array<{ game_id: string; selected_team_id: string }>; ownPreviewSelections?: Array<{ game_id: string; side: "favorite" | "underdog" }> };
      const nextGames = payload.games ?? [];
      setGames(nextGames);
      setChampionshipGameId(payload.season?.championship_game_id ?? null);
      if (payload.optedIn !== undefined) setOptedIn(payload.optedIn);
      const guess = payload.entry?.championship_total_guess == null ? "" : String(payload.entry.championship_total_guess);
      setChampionshipTotalGuess(guess);
      setSavedChampionshipTotalGuess(guess);
      if (payload.ownPicks) {
        const next = Object.fromEntries([...(payload.ownPreviewSelections ?? []).map((pick) => [pick.game_id, pick.side] as const), ...payload.ownPicks.flatMap((pick) => {
          const game = nextGames.find((candidate) => candidate.id === pick.game_id);
          if (!game) return [];
          const favoriteId = game.line?.favorite_team_id;
          const awayId = game.away_team_id ?? game.awayTeam?.id;
          const side = pick.selected_team_id === (favoriteId ?? awayId) ? "favorite" : "underdog";
          return [[pick.game_id, side as "favorite" | "underdog"]];
        })]);
        setSelections(next);
        setSavedSelections(next);
      }
    }).catch(() => setOptedIn(false));
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
  const firstKickoffMs = games.reduce<number | null>((earliest, game) => {
    if (!game.kickoff_at) return earliest;
    const kickoff = new Date(game.kickoff_at).getTime();
    return earliest === null || kickoff < earliest ? kickoff : earliest;
  }, null);
  const poolLocked = firstKickoffMs !== null && nowMs >= firstKickoffMs;
  const hasUnsavedChanges = !bowlSelectionsEqual(selections, savedSelections) || championshipTotalGuess !== savedChampionshipTotalGuess;
  const selectedGameCount = games.filter((game) => Boolean(selections[game.id])).length;
  const bowlReceipt = bowlReceiptSummary({ selectedCount: selectedGameCount, totalGames: games.length, tiebreaker: championshipTotalGuess, hasUnsavedChanges, isSubmitting });
  const gameLocked = (game: BowlGame) => Boolean(game.kickoff_at) && nowMs >= new Date(game.kickoff_at).getTime();
  const championshipLocked = Boolean(championshipGameId && games.find((game) => game.id === championshipGameId && gameLocked(game)));
  function chooseTeam(gameId: string, side: "favorite" | "underdog") {
    setSubmissionError("");
    if (selections[gameId] === side) {
      setSelections((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== gameId)));
      setSelectionFeedback(null);
      return;
    }
    setSelections((current) => ({ ...current, [gameId]: side }));
    setSelectionFeedback({ gameId, side, token: Date.now() });
  }
  async function submitSelections() {
    setIsSubmitting(true);
    setSubmissionError("");
    try {
      const selectionsToSave = Object.entries(selections).flatMap(([gameId, side]) => {
        const game = games.find((candidate) => candidate.id === gameId);
        if (!game || gameLocked(game)) return [];
        return [{ gameId, teamId: teamForSide(game, side)?.id ?? "", side }];
      });
      const parsedGuess = championshipTotalGuess.trim() === "" ? null : Number(championshipTotalGuess);
      const response = await fetchWithSession("/api/bowl-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optedIn: true, selections: selectionsToSave, championshipTotalGuess: parsedGuess }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Your Bowl Pool selections could not be saved.");
      }
      setSavedSelections(selections);
      setSavedChampionshipTotalGuess(championshipTotalGuess);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Your Bowl Pool selections could not be saved.");
    } finally { setIsSubmitting(false); }
  }

  async function changeOptIn(nextOptedIn: boolean) {
    setOptedIn(nextOptedIn);
    try {
      const selectionsToSave = Object.entries(selections).flatMap(([gameId, side]) => { const game = games.find((candidate) => candidate.id === gameId); return game && !gameLocked(game) ? [{ gameId, teamId: teamForSide(game, side)?.id ?? "", side }] : []; });
      const response = await fetchWithSession("/api/bowl-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optedIn: nextOptedIn, selections: nextOptedIn ? selectionsToSave : [], championshipTotalGuess: championshipTotalGuess.trim() === "" ? null : Number(championshipTotalGuess) }) });
      if (!response.ok) { setOptedIn(!nextOptedIn); throw new Error("Your Bowl Pool participation could not be saved."); }
      if (nextOptedIn) { setSavedSelections(selections); setSavedChampionshipTotalGuess(championshipTotalGuess); }
    } catch { setOptedIn(!nextOptedIn); }
  }

  function teamForSide(game: BowlGame, side: "favorite" | "underdog") {
    const favoriteId = game.line?.favorite_team_id;
    const awayId = game.away_team_id ?? game.awayTeam?.id;
    const homeId = game.home_team_id ?? game.homeTeam?.id;
    const selectedId = side === "favorite" ? (favoriteId ?? awayId) : (favoriteId === awayId ? homeId : awayId);
    return selectedId === awayId ? game.awayTeam : game.homeTeam;
  }

  function displayBowlName(game: BowlGame) {
    const name = game.bowl_name || "Bowl game";
    const key = game.provider_game_id ?? "";
    if (/quarterfinal|quarter/i.test(key) || /quarterfinal|quarter/i.test(name)) return `${name.replace(/\s*\([^)]*\)$/, "")} (QF)`;
    if (/semifinal|semi/i.test(key) || /semifinal|semi/i.test(name)) return `${name.replace(/\s*\([^)]*\)$/, "")} (SF)`;
    return name;
  }

  if (!isLoading && !canView) return null;

  return (
    <main className="bowl-pool-page mx-auto max-w-6xl px-2 py-8 sm:px-6 sm:py-10">
      {isLoading ? <p className="mt-4 text-slate-700">Loading…</p> : null}
      {!isLoading && canView ? (
        <>
          {poolLocked ? optedIn === false ? <div className="mt-6 border border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-700">Bowl Pool entry is closed for this year. Check back next year.</div> : null : optedIn === null ? <div aria-busy="true" className="mt-6 flex items-center justify-center gap-3 border border-slate-300 bg-white p-4 text-center text-sm font-bold text-slate-500 sm:p-5">Loading…</div> : <label className="mt-6 flex items-center justify-center gap-3 border border-slate-300 bg-white p-4 text-center sm:p-5"><input className="h-5 w-5 shrink-0" type="checkbox" checked={optedIn} onChange={(event) => void changeOptIn(event.target.checked)} /><span className="font-bold text-sm text-slate-700">I would like to participate in the NCAA Bowl Pool (you can opt out prior to first kickoff)</span></label>}
          {optedIn === true ? <section className="bowl-receipt-strip slate-mini-nav slate-receipt-strip is-pickem-only" aria-label="Your Bowl Pool receipt">
            <div className="slate-receipt-ticket">
              <span>BOWL RECEIPT</span>
              <button className={`slate-receipt-print ${hasUnsavedChanges ? "needs-attention" : ""}`} disabled={isSubmitting} onClick={() => void submitSelections()} type="button">SUBMIT</button>
            </div>
            <div className="slate-receipt-pool bowl-receipt-summary">
              <span>BOWL POOL</span>
              <div className="bowl-receipt-metrics">
                <div className="bowl-receipt-metric"><strong>{bowlReceipt.picksLabel}</strong><small>GAMES SELECTED</small></div>
                <div className={`bowl-receipt-metric ${bowlReceipt.tiebreakerLabel === "DUE" ? "is-due" : ""}`}><strong>{bowlReceipt.tiebreakerLabel}</strong><small>TIEBREAKER</small></div>
              </div>
              <em aria-live="polite" className={bowlReceipt.state === "complete" ? "is-complete" : bowlReceipt.state === "unsaved" ? "is-unsaved" : ""}>{bowlReceipt.status}</em>
            </div>
            {submissionError ? <p className="slate-receipt-warning" role="alert">{submissionError}</p> : null}
          </section> : null}
          {optedIn === true ? <section className="mt-4 border border-slate-300 bg-white p-2 sm:p-6" id="bowl-selections">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="mt-1 font-serif text-2xl font-bold">2026–27 Bowl Pool</h2>
            </div>
          </div>
          <div className="mt-4 overflow-hidden border border-slate-300 sm:mt-5">
            <div className="grid grid-cols-[3.25rem_minmax(5rem,1.45fr)_minmax(3.75rem,1fr)_1.75rem_minmax(3.75rem,1fr)] bg-slate-100 px-1 py-2 text-[10px] font-black uppercase tracking-[0.06em] text-slate-600 sm:grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] sm:gap-x-3 sm:px-4 sm:text-xs sm:tracking-[0.12em]">
              <span>Date / time</span><span>Bowl / location</span><span className="text-center">Fav</span><span className="text-center">Line</span><span className="text-center">Dog</span>
            </div>
            {!optedIn ? <div className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600">Check the box above to view the bowl schedule and participate.</div> : (games.length ? games : [{ id: "frisco-placeholder", bowl_name: "Frisco", kickoff_at: "", venue_city: "Frisco", venue_state: "TX", time_confirmed: true }]).map((game, index) => (
              <div className={`grid min-h-16 grid-cols-[3.25rem_minmax(5rem,1.45fr)_minmax(3.75rem,1fr)_1.75rem_minmax(3.75rem,1fr)] items-center border-t border-slate-200 px-1 pb-1.5 pt-2 text-slate-400 sm:grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] sm:gap-x-3 sm:px-4 sm:py-0 ${index % 2 ? "bg-slate-100" : "bg-white"}`} key={game.id}>
                <span className="text-[11px] leading-4 sm:text-xs sm:leading-5">{game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "Date TBD"}<br />{game.time_confirmed === false ? "Time TBD" : game.kickoff_at ? new Date(game.kickoff_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : ""}</span>
                <span className="min-w-0"><strong className="flex min-h-8 items-center truncate text-[11px] text-slate-700 sm:text-sm sm:whitespace-normal">{displayBowlName(game)}</strong><small className="block truncate">{game.venue_city && game.venue_state ? `${game.venue_city}, ${game.venue_state}` : "Location TBD"}</small></span>
                <button aria-label="Select favorite team" aria-pressed={selections[game.id] === "favorite"} className={`min-w-0 overflow-hidden text-center text-[11px] text-slate-950 disabled:cursor-not-allowed disabled:text-slate-950 disabled:opacity-100 sm:text-sm ${selections[game.id] === "favorite" ? "bowl-team-selection" : ""}`} disabled={gameLocked(game)} onClick={() => chooseTeam(game.id, "favorite")} type="button"><span className={`bowl-team-label block truncate ${selections[game.id] === "favorite" ? "bowl-team-label--selected" : ""} ${selectionFeedback?.gameId === game.id && selectionFeedback.side === "favorite" ? "bowl-team-label--new" : ""}`} key={selectionFeedback?.gameId === game.id && selectionFeedback.side === "favorite" ? `${game.id}-${selectionFeedback.token}` : game.id}>{teamForSide(game, "favorite")?.full_name || "Team TBD"}</span></button>
                <span className={`text-center text-xs sm:text-sm ${game.line?.locked_at ? "text-[#007e72]" : "text-slate-950"}`} aria-label="Spread">{game.line?.locked_spread ?? "—"}</span>
                <button aria-label="Select underdog team" aria-pressed={selections[game.id] === "underdog"} className={`min-w-0 overflow-hidden text-center text-[11px] text-slate-950 disabled:cursor-not-allowed disabled:text-slate-950 disabled:opacity-100 sm:text-sm ${selections[game.id] === "underdog" ? "bowl-team-selection" : ""}`} disabled={gameLocked(game)} onClick={() => chooseTeam(game.id, "underdog")} type="button"><span className={`bowl-team-label block truncate ${selections[game.id] === "underdog" ? "bowl-team-label--selected" : ""} ${selectionFeedback?.gameId === game.id && selectionFeedback.side === "underdog" ? "bowl-team-label--new" : ""}`} key={selectionFeedback?.gameId === game.id && selectionFeedback.side === "underdog" ? `${game.id}-${selectionFeedback.token}` : game.id}>{teamForSide(game, "underdog")?.full_name || "Team TBD"}</span></button>
              </div>
            ))}
          </div>
          <label className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm font-bold text-slate-700">National Championship total points tiebreaker<input className="w-[4.5rem] border border-slate-400 bg-white px-3 py-2 font-normal disabled:cursor-not-allowed disabled:bg-slate-100" disabled={championshipLocked} inputMode="numeric" min="0" max="200" type="number" value={championshipTotalGuess} onChange={(event) => { setSubmissionError(""); setChampionshipTotalGuess(event.target.value.replace(/\D/g, "").slice(0, 3)); }} /></label>
        </section> : null}
        </>
      ) : null}
    </main>
  );
}
