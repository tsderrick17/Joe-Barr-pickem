"use client";

import { useEffect, useState } from "react";
import { bowlPoolLaunchAt, bowlTeamName } from "@/lib/bowl-pool.js";

import { BowlClaimSeat, BowlCrest, BowlPennant } from "@/components/bowl-pool-marks";
import { bowlSpreadLabel } from "@/components/bowl-card";
import { bowlReceiptSummary, bowlSelectionsEqual } from "@/lib/bowl-receipt.js";
import { fetchWithSession } from "@/lib/auth-session";
import { currentSeasonYear } from "@/lib/season";
import FootballLoader from "@/components/football-loader";

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
  awayTeam?: { id: string; full_name: string; short_name?: string | null; abbreviation?: string | null; primary_color?: string | null; secondary_color?: string | null } | null;
  homeTeam?: { id: string; full_name: string; short_name?: string | null; abbreviation?: string | null; primary_color?: string | null; secondary_color?: string | null } | null;
  line?: { favorite_team_id?: string | null; locked_spread?: number | string; locked_at?: string | null } | null;
};

/** Kickoff time in Eastern as "7:30P" or "12:00A": A or P instead of AM or PM keeps the narrow date column on one line. */
function shortKickoffTime(kickoffAt: string) {
  return new Date(kickoffAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).replace(/\s?AM$/i, "A").replace(/\s?PM$/i, "P");
}

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
      setHasLaunched(Date.now() >= Date.parse(bowlPoolLaunchAt(currentSeasonYear())));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
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
  }, [hasLaunched]);

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
    <main className="bowl-pool-page mx-auto max-w-6xl px-2 pb-8 pt-0 sm:px-6 sm:pb-10">
      {isLoading ? <div aria-busy="true" aria-label="Loading Bowl Pool" className="bowl-pool-loading-shell football-loading-screen mt-4"><FootballLoader /></div> : null}
      {!isLoading && canView ? (
        <>
          {poolLocked ? optedIn === false ? <div className="mt-4 border border-slate-300 bg-(color:--themed-bg-26) p-4 text-center text-sm font-bold text-slate-600">Bowl Pool entry is closed for this year. Check back next year.</div> : null : optedIn === null ? <div aria-busy="true" className="mt-4 flex items-center justify-center gap-3 border border-slate-300 bg-(color:--themed-bg-26) p-3 text-center text-sm font-bold text-slate-500">Loading…</div> : optedIn === false ? <BowlClaimSeat onClaim={() => void changeOptIn(true)} /> : null}
          {optedIn === true ? <div className="bowl-receipt-frame"><div className="bowl-receipt-frame-inner"><section className="bowl-receipt-strip slate-mini-nav slate-receipt-strip is-pickem-only" aria-label="Your Bowl Pool receipt">
            <div className="slate-receipt-ticket">
              <span>BOWL RECEIPT</span>
              <button className={`slate-receipt-print ${hasUnsavedChanges ? "needs-attention" : ""}`} disabled={isSubmitting} onClick={() => void submitSelections()} type="button">SUBMIT</button>
              <span aria-live="polite" className={`receipt-printing-status ${isSubmitting ? "is-printing" : ""}`} role="status">
                <span aria-hidden="true" className="receipt-printing-marks"><i /><i /><i /></span>
                <span>{isSubmitting ? "PRINTING" : ""}</span>
              </span>
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
          </section></div></div> : null}
          {optedIn === true ? <section className="bowl-pool-board mt-3 border border-slate-300 bg-(color:--themed-bg-26) p-2 sm:p-6" id="bowl-selections">
          <div className="bowl-title-row flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-slate-200 pb-4">
            <BowlCrest seasonYear={currentSeasonYear()} title="BOWL POOL" />
            <ul aria-label="Bowl Pool instructions" className="bowl-rules-compact"><li>Pick every bowl, including playoffs, against the spread. Participation is optional.</li><li>A game with no pick counts as a loss.</li><li>Selections lock and are revealed to others at kickoff.</li><li>Tiebreaker is total points in Championship game.</li></ul>
            {!poolLocked ? <div className="bowl-optout"><button onClick={() => void changeOptIn(false)} type="button">Opt out</button></div> : null}
          </div>
          <div className="mt-4 overflow-hidden border border-slate-300 sm:mt-5">
            <div className="grid grid-cols-[3.25rem_minmax(5rem,1.45fr)_minmax(3.75rem,1fr)_1.75rem_minmax(3.75rem,1fr)] bg-(color:--themed-bg-25) px-1 py-2 text-[10px] font-black uppercase tracking-[0.06em] text-slate-600 sm:grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] sm:gap-x-3 sm:px-4 sm:text-xs sm:tracking-[0.12em]">
              <span>Date<br />Time</span><span>Bowl<br />Location</span><span className="text-center">Fav</span><span className="text-center">Line</span><span className="text-center">Dog</span>
            </div>
            {!optedIn ? <div className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600">Check the box above to view the bowl schedule and participate.</div> : (games.length ? games : [{ id: "frisco-placeholder", bowl_name: "Frisco", kickoff_at: "", venue_city: "Frisco", venue_state: "TX", time_confirmed: true }]).map((game, index) => (
              <div className={`bowl-selection-game-row grid min-h-16 grid-cols-[3.25rem_minmax(5rem,1.45fr)_minmax(3.75rem,1fr)_1.75rem_minmax(3.75rem,1fr)] items-center border-t border-slate-200 px-1 pb-1.5 pt-2 text-slate-400 sm:grid-cols-[minmax(6rem,0.7fr)_minmax(11rem,1.3fr)_minmax(8rem,1fr)_minmax(5rem,0.55fr)_minmax(8rem,1fr)] sm:gap-x-3 sm:px-4 sm:py-0 ${index % 2 ? "bg-(color:--themed-bg-25)" : "bg-(color:--themed-bg-26)"}`} key={game.id}>
                <span className="text-[11px] leading-4 sm:text-xs sm:leading-5">{game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "Date TBD"}<br />{game.time_confirmed === false ? "Time TBD" : game.kickoff_at ? shortKickoffTime(game.kickoff_at) : ""}</span>
                <span className="min-w-0"><strong className="bowl-game-name flex min-h-8 items-center truncate text-[11px] text-slate-700 sm:text-sm sm:whitespace-normal">{displayBowlName(game)}</strong><small className="block truncate">{game.venue_city && game.venue_state ? `${game.venue_city}, ${game.venue_state}` : "Location TBD"}</small></span>
                <button aria-label={`Select favorite team${teamForSide(game, "favorite")?.full_name ? `: ${teamForSide(game, "favorite")?.full_name}` : ""}`} aria-pressed={selections[game.id] === "favorite"} className={`bowl-pick-box min-w-0 overflow-hidden text-center text-[11px] text-slate-950 disabled:cursor-not-allowed disabled:text-slate-950 disabled:opacity-100 sm:text-sm ${selections[game.id] === "favorite" ? "bowl-team-selection" : ""}`} disabled={gameLocked(game)} onClick={() => chooseTeam(game.id, "favorite")} title={teamForSide(game, "favorite")?.full_name ?? "Team TBD"} type="button">{selections[game.id] === "favorite" ? <span className={`bowl-team-pick ${selectionFeedback?.gameId === game.id && selectionFeedback.side === "favorite" ? "is-new" : ""}`} key={selectionFeedback?.gameId === game.id && selectionFeedback.side === "favorite" ? `${game.id}-${selectionFeedback.token}` : game.id}><BowlPennant side="left" team={teamForSide(game, "favorite")} /></span> : <span className="bowl-team-label block truncate">{bowlTeamName(teamForSide(game, "favorite"))}</span>}</button>
                <span className={`bowl-game-line text-center text-xs sm:text-sm ${game.line?.locked_at ? "text-[#007e72]" : "text-slate-950"}`} aria-label="Spread">{bowlSpreadLabel(game.line?.locked_spread)}</span>
                <button aria-label={`Select underdog team${teamForSide(game, "underdog")?.full_name ? `: ${teamForSide(game, "underdog")?.full_name}` : ""}`} aria-pressed={selections[game.id] === "underdog"} className={`bowl-pick-box min-w-0 overflow-hidden text-center text-[11px] text-slate-950 disabled:cursor-not-allowed disabled:text-slate-950 disabled:opacity-100 sm:text-sm ${selections[game.id] === "underdog" ? "bowl-team-selection" : ""}`} disabled={gameLocked(game)} onClick={() => chooseTeam(game.id, "underdog")} title={teamForSide(game, "underdog")?.full_name ?? "Team TBD"} type="button">{selections[game.id] === "underdog" ? <span className={`bowl-team-pick ${selectionFeedback?.gameId === game.id && selectionFeedback.side === "underdog" ? "is-new" : ""}`} key={selectionFeedback?.gameId === game.id && selectionFeedback.side === "underdog" ? `${game.id}-${selectionFeedback.token}` : game.id}><BowlPennant side="left" team={teamForSide(game, "underdog")} /></span> : <span className="bowl-team-label block truncate">{bowlTeamName(teamForSide(game, "underdog"))}</span>}</button>
              </div>
            ))}
          </div>
          <label className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm font-bold text-slate-700">National Championship total points tiebreaker<input className="w-[4.5rem] border border-slate-400 bg-(color:--themed-bg-26) px-3 py-2 font-normal disabled:cursor-not-allowed disabled:bg-(color:--themed-bg-25)" disabled={championshipLocked} inputMode="numeric" min="0" max="200" type="number" value={championshipTotalGuess} onChange={(event) => { setSubmissionError(""); setChampionshipTotalGuess(event.target.value.replace(/\D/g, "").slice(0, 3)); }} /></label>
        </section> : null}
        </>
      ) : null}
    </main>
  );
}
