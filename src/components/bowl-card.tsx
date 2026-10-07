"use client";

import { useEffect, useRef, useState } from "react";
import Collapse from "@/components/collapse";
import { BowlClaimSeat, BowlCrest } from "@/components/bowl-pool-marks";
import BowlScoreTile from "@/components/bowl-score-tile";
import PlayerTrophyName from "@/components/player-trophy-name";
import { fetchWithSession } from "@/lib/auth-session";
import { bowlMatchupTeamLabels, bowlTeamDisplayLabel } from "@/lib/bowl-pool.js";
import { currentSeasonYear } from "@/lib/season";

type BowlStandingsData = {
  season?: { season_year: number };
  optedIn?: boolean;
  entryOpen?: boolean;
  games: Array<{ id: string; bowl_name: string; status?: string; provider_game_id?: string; is_cfp?: boolean; kickoff_at?: string; away_team_id?: string | null; home_team_id?: string | null; awayTeam?: { id: string; full_name: string; short_name?: string | null; abbreviation?: string | null } | null; homeTeam?: { id: string; full_name: string; short_name?: string | null; abbreviation?: string | null } | null; line?: { favorite_team_id?: string | null; locked_spread?: number | string | null; locked_at?: string | null } | null }>;
  standings: Array<{ playerId: string; playerName: string; wins: number; losses: number; tiebreakerTotal: number | null; trophies?: string[] }>;
  championships?: Array<{ playerId: string; seasonYear: number; playerName: string }>;
  publicPicks: Array<{ playerId: string | null; game_id: string; selected_team_id: string; result: string }>;
  ownPicks?: Array<{ game_id: string; selected_team_id: string }>;
  ownPreviewSelections?: Array<{ game_id: string; side: "favorite" | "underdog" }>;
  automaticResults?: Array<{ playerId: string | null; game_id: string; result: string }>;
  privatePickMarkers?: Array<{ playerId: string | null; game_id: string }>;
};
type BowlMatrixGame = BowlStandingsData["games"][number];

/** One spin per player per Eastern day: remembered in this browser. */
function scoreSpinKey(playerId: string | undefined) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  return `bowl-scores-spun:${playerId ?? "anon"}:${day}`;
}
function scoresSpunToday(playerId: string | undefined) {
  try { return typeof window !== "undefined" && window.localStorage.getItem(scoreSpinKey(playerId)) === "1"; } catch { return false; }
}
function markScoresSpun(playerId: string | undefined) {
  try { window.localStorage.setItem(scoreSpinKey(playerId), "1"); } catch { /* private browsing: it just spins again next time */ }
}

const BOWL_MATRIX_GAMES = [
  "Frisco", "LA", "Salute to Veterans", "Cure", "68 Ventures", "Xbox", "Myrtle Beach", "Gasparilla",
  "Playoff Game #1", "Playoff Game #2", "Playoff Game #3", "Playoff Game #4", "Potato", "Boca Raton", "New Orleans", "Frisco",
  "Hawai'i", "GameAbove Sports", "Rate", "First Responder", "Military", "Pinstripe", "Fenway", "Pop-Tarts", "Arizona", "New Mexico", "Gator",
  "Birmingham", "Independence", "Music City", "Alamo", "ReliaQuest", "Sun", "Citrus", "Las Vegas", "Armed Forces", "Liberty", "Duke's Mayo", "Holiday",
];

type Props = {
  viewerPlayerId: string | undefined;
  isCommissioner: boolean | undefined;
  /** Players to list (with no wins) before the Bowl Pool has its own standings. */
  fallbackRows: Array<{ id: string; firstName: string }>;
  minimized: boolean;
  /** The off-season: the card is shown whole and its hide button is gone. */
  displayLocked?: boolean;
  savingDisplay: boolean;
  onSetDisplay: (show: boolean) => Promise<void>;
  onError: (message: string) => void;
  /** Called once the card's first load has finished (even if it failed), so the page can reveal everything together. */
  onReady?: () => void;
};

/**
 * The Standings page's Bowl Card: the Claim your seat ticket before joining,
 * then the crest, the scoreboard header, and every player's results. It loads
 * its own data, so the rest of the page never redraws when it changes.
 */
/** The favorite is always listed on top, so the spread needs no minus sign. */
export function bowlSpreadLabel(spread: number | string | null | undefined) {
  if (spread == null || spread === "") return "—";
  return String(spread).replace(/^[-−]\s*/, "");
}

export default function BowlCard({ viewerPlayerId, isCommissioner, fallbackRows, minimized, displayLocked = false, savingDisplay, onSetDisplay, onError, onReady }: Props) {
  const [bowlStandings, setBowlStandings] = useState<BowlStandingsData | null>(null);
  const [claiming, setClaiming] = useState(false);
  const bowlScrollRef = useRef<HTMLDivElement | null>(null);
  // The score tiles spin once per visit: the first time the Bowl Card comes
  // into view, then land on the real totals about a second later.
  // The scores spin the first time a player looks at the card each day (Eastern), then stay
  // still for the rest of that day.
  const [animateScores] = useState(() => !scoresSpunToday(viewerPlayerId));
  const [bowlScoresSettled, setBowlScoresSettled] = useState(false);

  useEffect(() => {
    const loadBowlStandings = () => void fetchWithSession("/api/bowl-pool", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setBowlStandings(await response.json() as BowlStandingsData);
    }).catch(() => undefined).finally(() => onReady?.());
    loadBowlStandings();
    const refreshFromHistory = (event: PageTransitionEvent) => { if (event.persisted) loadBowlStandings(); };
    window.addEventListener("pageshow", refreshFromHistory);
    return () => window.removeEventListener("pageshow", refreshFromHistory);
  }, [isCommissioner, onReady]);


  const bowlGames: BowlMatrixGame[] = bowlStandings?.games ?? BOWL_MATRIX_GAMES.map((bowlName, index) => ({ id: `placeholder-${index}`, bowl_name: bowlName }));
  const bowlScheduleReady = Boolean(bowlStandings?.games);
  const bowlRows = [...(bowlStandings?.standings ?? fallbackRows.map((row) => ({ playerId: row.id, playerName: row.firstName, wins: 0, losses: 0, tiebreakerTotal: null, trophies: [] })) ?? [])].sort((first, second) => second.wins - first.wins || first.losses - second.losses || first.playerName.localeCompare(second.playerName));
  const bowlChampion = bowlStandings?.championships?.find((championship) => championship.seasonYear === bowlStandings.season?.season_year);
  const bowlGradedGames = bowlStandings?.games ? bowlStandings.games.filter((game) => ["final", "cancelled", "no_contest"].includes(game.status ?? "")).length : 0;
  const bowlName = (game: (typeof bowlGames)[number]) => {
    const name = (game.bowl_name || "Bowl").replace(/ Football Classic$/i, "");
    const cleanName = name.replace(/\s*\([^)]*\)$/, "");
    const qfBowl = /^(fiesta|cotton|peach|rose)(?: bowl)?$/i.test(cleanName);
    const sfBowl = /^(orange|sugar)(?: bowl)?$/i.test(cleanName);
    if (/quarterfinal|quarter/i.test(name) || /quarterfinal/i.test(game.provider_game_id ?? "") || qfBowl) return `${cleanName} (QF)`;
    if (/semifinal|semi/i.test(name) || /semifinal/i.test(game.provider_game_id ?? "") || sfBowl) return `${cleanName} (SF)`;
    return name;
  };
  const bowlTeamLabel = (team: { id?: string; full_name: string; short_name?: string | null; abbreviation?: string | null } | null | undefined, otherTeam?: { id?: string; full_name: string; short_name?: string | null; abbreviation?: string | null } | null) => {
    if (otherTeam) {
      const [teamLabel, otherLabel] = bowlMatchupTeamLabels(team, otherTeam);
      return team?.id === otherTeam.id ? otherLabel : teamLabel;
    }
    return bowlTeamDisplayLabel(team);
  };
  const bowlDateKey = (game: (typeof bowlGames)[number]) => game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "Date TBD";
  const bowlDateGroups = bowlGames.reduce<Array<{ key: string; count: number }>>((groups, game) => { const key = bowlDateKey(game); const last = groups[groups.length - 1]; if (last?.key === key) last.count += 1; else groups.push({ key, count: 1 }); return groups; }, []);
  // Keep the grid's containing block as wide as its generated tracks. Without
  // this, CSS grid tracks overflow the 80rem shell while row borders stop at
  // the shell's edge (which made the table appear to end mid-schedule).
  // The same game width the columns use, so the rows always fill the table behind them.
  const bowlTableMinWidth = `calc(14.5rem + ${bowlGames.length} * var(--bowl-game-width, 7.5rem))`;
  const bowlGameBoundaryClass = (index: number) => {
    const key = bowlDateKey(bowlGames[index]);
    const previousKey = index > 0 ? bowlDateKey(bowlGames[index - 1]) : null;
    const nextKey = index < bowlGames.length - 1 ? bowlDateKey(bowlGames[index + 1]) : null;
    return `${previousKey !== key ? "border-l-2" : ""} ${nextKey !== key ? "border-r-2" : ""} border-[#8d877d]`;
  };
  const bowlTeam = (game: (typeof bowlGames)[number], side: "favorite" | "underdog") => {
    const away = game.awayTeam; const home = game.homeTeam; const favoriteId = game.line?.favorite_team_id;
    const favorite = favoriteId && away?.id === favoriteId ? away : favoriteId && home?.id === favoriteId ? home : away;
    const underdog = favorite?.id === away?.id ? home : away;
    return side === "favorite" ? favorite : underdog;
  };
  const bowlGameTeamLabels = (game: (typeof bowlGames)[number]) => {
    const favorite = bowlTeam(game, "favorite");
    const underdog = bowlTeam(game, "underdog");
    const [favoriteLabel, underdogLabel] = bowlMatchupTeamLabels(favorite, underdog);
    return { favorite, underdog, favoriteLabel, underdogLabel };
  };
  const bowlCell = (playerId: string, gameId: string) => {
    const result = bowlStandings?.publicPicks.find((pick) => pick.playerId === playerId && pick.game_id === gameId)?.result
      ?? bowlStandings?.automaticResults?.find((result) => result.playerId === playerId && result.game_id === gameId)?.result;
    return result === "win" ? "W" : result === "loss" ? "L" : "·";
  };
  const bowlOwnCell = (game: BowlMatrixGame) => {
    const saved = bowlStandings?.ownPicks?.find((pick) => pick.game_id === game.id);
    if (saved) {
      const team = [game.awayTeam, game.homeTeam].find((candidate) => candidate?.id === saved.selected_team_id);
      if (!team) return "·";
      const labels = bowlGameTeamLabels(game);
      return team.id === labels.favorite?.id ? labels.favoriteLabel : team.id === labels.underdog?.id ? labels.underdogLabel : bowlTeamLabel(team);
    }
    const preview = bowlStandings?.ownPreviewSelections?.find((pick) => pick.game_id === game.id);
    return preview ? (preview.side === "favorite" ? "FAV" : "DOG") : "·";
  };
  const bowlCellClass = (result: string) => result === "W" ? "text-green-800" : result === "L" ? "text-red-700" : result === "🔒" ? "text-slate-500" : result === "·" ? "text-slate-400" : "text-slate-950";

  // Before the Bowl Pool begins, leave the sheet at its natural left edge.
  // Once a Bowl game day is underway, bring that day's first game directly
  // beside the frozen player columns. This uses Eastern time, matching the
  // pool's kickoff and lock rules.
  useEffect(() => {
    if (minimized || !bowlGames.length) return;
    const frame = window.requestAnimationFrame(() => {
      const container = bowlScrollRef.current;
      if (!container) return;
      const todayKey = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(new Date());
      const currentDayIndex = bowlGames.findIndex((game) => game.kickoff_at && new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(new Date(game.kickoff_at)) === todayKey);
      if (currentDayIndex < 0) {
        container.scrollLeft = 0;
        return;
      }
      const target = container.querySelector<HTMLElement>(`[data-bowl-game-index="${currentDayIndex}"]`);
      if (target) {
        const targetLeft = target.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
        const stickyColumns = Number.parseFloat(window.getComputedStyle(container).scrollPaddingLeft) || 0;
        container.scrollLeft = Math.max(0, targetLeft - stickyColumns);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bowlGames, minimized]);
  useEffect(() => {
    if (bowlScoresSettled && animateScores) markScoresSpun(viewerPlayerId);
  }, [bowlScoresSettled, animateScores, viewerPlayerId]);
  useEffect(() => {
    // Runs only when the card itself changes: an ordinary re-render (a data
    // refresh) must never cancel the landing timer.
    const container = bowlScrollRef.current;
    if (!container || bowlScoresSettled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setBowlScoresSettled(true), 0);
      return () => window.clearTimeout(timer);
    }
    let timer = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      timer = window.setTimeout(() => setBowlScoresSettled(true), 350);
    }, { threshold: 0.25 });
    observer.observe(container);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [bowlScoresSettled, minimized, bowlStandings]);

  async function claimBowlSeat() {
    if (savingDisplay || claiming) return;
    setClaiming(true);
    try {
      const response = await fetchWithSession("/api/bowl-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optedIn: true, selections: [], championshipTotalGuess: null }),
      });
      if (!response.ok) throw new Error("Your seat in the Bowl Pool could not be saved.");
      const refreshed = await fetchWithSession("/api/bowl-pool", { cache: "no-store" });
      if (refreshed.ok) setBowlStandings(await refreshed.json() as BowlStandingsData);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Your seat in the Bowl Pool could not be saved.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      {bowlStandings && bowlStandings.optedIn === false && bowlStandings.entryOpen ? <section className="bowl-card-section py-6 sm:py-7"><BowlCrest seasonYear={bowlStandings.season?.season_year ?? currentSeasonYear()} seasonSuffix="Special" title="BOWL CARD" /><BowlClaimSeat busy={savingDisplay || claiming} onClaim={() => void claimBowlSeat()} /></section> : bowlStandings ? <section className={`pickem-ledger bowl-card-section py-6 sm:py-7 ${minimized ? "is-minimized" : ""}`} aria-label="Bowl Card">
          <BowlCrest action={displayLocked ? undefined : <button aria-expanded={!minimized} aria-label={minimized ? "Show Bowl Card" : "Hide Bowl Card"} className="survivor-title-toggle" disabled={savingDisplay} onClick={() => void onSetDisplay(minimized)} title={minimized ? "Show Bowl Card" : "Hide Bowl Card"} type="button">{minimized ? "+" : "−"}</button>} seasonYear={bowlStandings.season?.season_year ?? currentSeasonYear()} seasonSuffix="Special" title="BOWL CARD" />
          <Collapse open={!minimized}>
            {bowlChampion ? <div className="border-b-2 border-[#1d1d1f] bg-[#f8f0d8] px-3 py-3 text-center font-bold text-[#5a430c]">🏆 {bowlChampion.playerName} — Bowl Pool Champion</div> : null}
            <div className="bowl-standings-scroll overflow-x-auto border-b-2 border-[#1d1d1f]" ref={bowlScrollRef}>
              <div style={{ minWidth: bowlTableMinWidth }}>
                <div className="grid" style={{ gridTemplateColumns: `3rem 5rem repeat(${bowlGames.length}, minmax(var(--bowl-game-width, 7.5rem), 1fr)) minmax(6.5rem, .72fr)` }}><span aria-hidden="true" className="bowl-standings-sticky sticky left-0 z-30 bg-[#f5f0e6]" style={{ gridColumn: "span 2" }} />{bowlDateGroups.map((group) => <span className="border-x-2 border-t-2 border-[#8d877d] bg-[#334155] px-2 py-2 text-center text-[10px] font-black uppercase tracking-wide text-white" key={group.key} style={{ gridColumn: `span ${group.count} / span ${group.count}` }}>{group.key}</span>)}<span aria-hidden="true" className="border-l-2 border-[#8d877d] bg-transparent" /></div>
                <div className="grid" style={{ gridTemplateColumns: `3rem 5rem repeat(${bowlGames.length}, minmax(var(--bowl-game-width, 7.5rem), 1fr)) minmax(6.5rem, .72fr)` }}><span className="bowl-standings-summary-cell bowl-standings-sticky sticky left-0 z-30 flex min-h-28 flex-col items-center justify-center bg-[#f5f0e6] px-1 text-center uppercase text-slate-700" style={{ gridColumn: "span 2" }}><span className="bowl-games-remaining-label text-[9px] font-black tracking-wide"><span className="block">Games</span><span className="block">remaining</span></span><BowlScoreTile animate={animateScores} landDelay={0} large settled={bowlScoresSettled && bowlScheduleReady} value={Math.max(0, bowlGames.length - bowlGradedGames)} viewer /></span>{bowlGames.map((game, index) => { const labels = bowlGameTeamLabels(game); return <span className={`bowl-standings-game-cell flex flex-col items-center bg-[#f7f3ea] px-2 py-1.5 text-center text-[10px] leading-4 text-slate-700 ${bowlGameBoundaryClass(index)}`} data-bowl-game-index={index} key={`${game.id}-${index}`}><b className="bowl-standings-bowl-name flex min-h-8 w-full items-center justify-center text-xs uppercase leading-4 tracking-wide text-slate-900">{bowlName(game)}</b><span className="bowl-standings-team block w-full truncate font-bold text-slate-950" title={labels.favorite?.full_name}>{labels.favoriteLabel}</span><span className={`bowl-standings-line block font-mono font-black ${game.line?.locked_at ? "text-[#007e72]" : "text-slate-950"}`}>{bowlSpreadLabel(game.line?.locked_spread)}</span><span className="bowl-standings-team block w-full truncate font-bold text-slate-950" title={labels.underdog?.full_name}>{labels.underdogLabel}</span></span>; })}<span className="bowl-standings-tiebreaker-header flex items-center justify-center border-l-2 border-[#8d877d] bg-[#f5f0e6] px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-wide text-slate-700">Tiebreaker</span></div>
                {bowlRows.map((row, rowIndex) => { const rowFill = rowIndex % 2 ? "is-alt bg-[#f3f0e8]" : "bg-[#fffdf8]"; const isViewer = row.playerId === viewerPlayerId; return <div className={`bowl-standings-player-row grid border-b border-[#91afd0] text-center text-xs ${isViewer ? "is-viewer" : ""} ${rowIndex === 0 ? "border-t-2 border-t-[#1d1d1f]" : ""} ${rowFill}`} style={{ gridTemplateColumns: `3rem 5rem repeat(${bowlGames.length}, minmax(var(--bowl-game-width, 7.5rem), 1fr)) minmax(6.5rem, .72fr)` }} key={row.playerId}><span className={`bowl-standings-sticky bowl-standings-score-cell sticky left-0 z-30 px-1 py-2 text-center ${rowFill}`}><BowlScoreTile animate={animateScores} landDelay={(rowIndex + 1) * 90} settled={bowlScoresSettled} value={row.wins} viewer={isViewer} /></span><span className={`bowl-standings-sticky sticky left-[3rem] z-30 truncate px-1 py-2 text-left font-serif text-[13px] font-extrabold leading-tight tracking-[0.01em] sm:text-base ${rowFill}`} title={row.playerName}><PlayerTrophyName name={row.playerName} showTrophy={row.trophies?.some((title) => title.includes("Bowl Pool Champion"))} titles={row.trophies} /></span>{bowlGames.map((game, index) => { const result = isViewer ? bowlOwnCell(game) : bowlCell(row.playerId, game.id); const locked = !isViewer && bowlStandings?.privatePickMarkers?.some((pick) => pick.playerId === row.playerId && pick.game_id === game.id); const display = result === "·" && locked ? "🔒" : result; return <span className={`px-1 py-2 font-black ${bowlCellClass(display)} ${bowlGameBoundaryClass(index)}`} key={`${row.playerId}-${game.id}-${index}`}>{display}</span>; })}<span className="flex items-center justify-center border-l-2 border-[#8d877d] px-2 py-2 font-mono text-[13px] font-extrabold tabular-nums text-slate-700 sm:text-base">{row.tiebreakerTotal ?? "—"}</span></div>; })}
              </div>
            </div>
          </Collapse>
        </section> : null}
    </>
  );
}
