"use client";

import { useEffect, useState } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { isSurvivorTeamUnavailable } from "@/lib/survivor-availability";

type Team = { id: string; name: string; abbreviation: string };
type Game = {
  id: string;
  kickoffAt: string;
  status: string;
  awayTeam: Team;
  homeTeam: Team;
};
type SurvivorData = {
  week: { name: string; status: string };
  entry: { status: "active" | "eliminated" | "complete"; pick: { game_id: string; selected_team_id: string } | null };
  champion: { playerId: string; name: string } | null;
  usedTeamIds: string[];
  byeTeams: string[];
  games: Game[];
  error?: string;
};

export default function SurvivorPage() {
  const [data, setData] = useState<SurvivorData | null>(null);
  const [selected, setSelected] = useState<{ gameId: string; teamId: string } | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("error");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const response = await fetchWithSession("/api/survivor");
      const result = (await response.json()) as SurvivorData;
      if (!response.ok) throw new Error(result.error ?? "The Survivor Wire could not be loaded.");
      setData(result);
      setSelected(result.entry.pick ? { gameId: result.entry.pick.game_id, teamId: result.entry.pick.selected_team_id } : null);
    } catch (error) {
      if (error instanceof SessionUnavailableError) window.location.assign("/login");
      else { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "The Survivor Wire could not be loaded."); }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    if (!data || data.entry.status !== "active") return;
    setSaving(true); setMessage("");
    try {
      const response = await fetchWithSession("/api/survivor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected ? { gameId: selected.gameId, teamId: selected.teamId } : {}) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Your Survivor pick could not be saved.");
      setMessageKind("success"); setMessage(result.message ?? "Your Survivor pick has been saved.");
      window.setTimeout(() => window.location.reload(), 850);
    } catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "Your Survivor pick could not be saved."); }
    finally { setSaving(false); }
  }

  if (!data) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">{message || "Loading The Survivor Wire..."}</main>;
  const eliminated = data.entry.status === "eliminated";
  const complete = data.entry.status === "complete";
  const currentPick = data.entry.pick && data.games.flatMap((game) => [game.awayTeam, game.homeTeam]).find((team) => team.id === data.entry.pick?.selected_team_id);
  const hasUnsavedChange = Boolean(selected && (!data.entry.pick || selected.gameId !== data.entry.pick.game_id || selected.teamId !== data.entry.pick.selected_team_id));
  const selectedTeam = selected && data.games.flatMap((game) => [game.awayTeam, game.homeTeam]).find((team) => team.id === selected.teamId);

  return <main className={`min-h-screen bg-[#f5f0e6] px-4 py-5 text-[#171719] sm:px-5 sm:py-8 md:px-10 ${hasUnsavedChange ? "pb-36 sm:pb-32" : ""}`}><div className="mx-auto max-w-3xl">
    <header className="border-b-4 border-[#171719] pb-4"><p className="text-[11px] font-bold tracking-[.22em] text-slate-600">STRAIGHT-UP SURVIVOR · {data.week.name.toUpperCase()}</p><h1 className="mt-1 font-serif text-4xl font-black tracking-tight sm:text-5xl">The Survivor Wire</h1><p className="mt-2 max-w-xl text-sm font-bold text-[#171719]">Each team may be used once per season.</p><p className="mt-1 max-w-xl text-sm text-slate-700">Pick one outright winner and click &ldquo;Submit&rdquo; at the bottom.</p>{data.byeTeams.length ? <p className="mt-3 text-[11px] font-bold tracking-[.12em] text-slate-600">BYE THIS WEEK: {data.byeTeams.join(", ")}</p> : null}</header>
    {complete ? <section className="mt-5 border-l-4 border-green-800 bg-[#edf7ef] px-4 py-3 text-green-950"><p className="text-xs font-black tracking-[.16em]">SURVIVOR CHAMPION</p><h2 className="mt-1 font-serif text-2xl font-black">Congratulations, {data.champion?.name}!</h2><p className="mt-1 text-sm">The Survivor pool is complete for the season. The Wire remains as the permanent record.</p></section> : eliminated ? <section className="mt-5 border-l-4 border-[#171719] bg-[#e7e1d5] px-4 py-3"><p className="text-xs font-black tracking-[.16em] text-zinc-600">SURVIVOR STATUS</p><h2 className="mt-1 font-serif text-2xl font-black">You have been eliminated.</h2><p className="mt-1 text-sm">The matchups remain available to follow the pool, but your entry is closed.</p></section> : <section className="mt-5 border-l-4 border-green-800 bg-[#edf7ef] px-4 py-3 text-green-950"><p className="font-bold">{currentPick ? `Your ${data.week.name} pick: ${currentPick.name}` : "A Survivor pick is due this week."}</p><p className="mt-1 text-sm">You may change it until that matchup begins.</p></section>}
    <section className={`mt-7 border-t-4 border-[#171719] ${eliminated || complete ? "grayscale" : ""}`}><div className="flex items-center justify-between border-b border-[#171719] py-3"><h2 className="font-serif text-2xl font-black">This week&apos;s matchups</h2><span className="text-[11px] font-bold tracking-[.16em] text-slate-600">{eliminated || complete ? "VIEW ONLY" : "SELECT ONE"}</span></div><div className="grid grid-cols-[1fr_2rem_1fr] border-b border-[#d1c9ba] text-center text-[10px] font-bold tracking-[.16em] text-slate-600"><span className="py-2">AWAY</span><span /><span className="py-2">HOME</span></div><div className="divide-y divide-[#c9c1b2]">
      {data.games.map((game) => { const started = new Date(game.kickoffAt) <= new Date(); const teams = [game.awayTeam, game.homeTeam]; return <article className="py-1" key={game.id}><div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center">{teams.map((team, index) => { const chosen = selected?.teamId === team.id; const official = data.entry.pick?.selected_team_id === team.id; const unavailable = isSurvivorTeamUnavailable({ teamId: team.id, usedTeamIds: data.usedTeamIds, savedPickTeamId: data.entry.pick?.selected_team_id ?? null, gameStarted: started, entryEliminated: eliminated || complete }); const chip = <button aria-label={`Choose ${team.name}`} aria-pressed={chosen} className="survivor-chip-button" disabled={unavailable} onClick={() => setSelected(chosen ? null : { gameId: game.id, teamId: team.id })} title={unavailable ? `${team.name} is unavailable` : `Choose ${team.name}`} type="button"><SurvivorPokerChip abbreviation={team.abbreviation} official={official} selected={chosen} teamName={team.name} unavailable={unavailable} /></button>; return <div className={`survivor-matchup-team grid min-h-20 items-center gap-2 px-1 py-2 sm:px-3 ${chosen ? "is-selected" : ""} ${index === 0 ? "grid-cols-[minmax(0,1fr)_auto]" : "col-start-3 grid-cols-[auto_minmax(0,1fr)]"}`} key={team.id}>{index === 0 ? <><span className="text-right text-xs font-bold leading-4 text-zinc-800 sm:text-sm">{team.name}</span>{chip}</> : <>{chip}<span className="text-left text-xs font-bold leading-4 text-zinc-800 sm:text-sm">{team.name}</span></>}</div>; })}<span aria-hidden="true" className="col-start-2 row-start-1 text-center font-serif text-[10px] font-black italic tracking-[.08em] text-slate-400">VS</span></div></article>; })}
    </div></section>
    {!eliminated && !complete && hasUnsavedChange ? <aside className="survivor-selection-footer fixed inset-x-0 bottom-0 z-20 border-t-2 border-[#1d1d1f] bg-[#f5f0e6] shadow-[0_-8px_24px_rgba(0,0,0,0.1)]"><div className="mx-auto flex max-w-3xl flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5"><div className="flex min-w-0 items-center gap-2"><SurvivorPokerChip abbreviation={selectedTeam?.abbreviation ?? "NFL"} selected size="summary" teamName={selectedTeam?.name ?? "Selection"} /><div><p className="text-[11px] font-black tracking-[.14em] text-slate-600">YOUR SURVIVOR PICK</p><p className="font-serif text-lg font-bold">{selectedTeam?.name}</p></div></div><div className="flex items-center gap-3"><span className="text-xs font-bold text-amber-800">Unsaved change</span><button className="min-h-11 bg-[#1d1d1f] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={saving} onClick={save} type="button">{saving ? "Saving..." : currentPick ? "Save change" : "Submit pick"}</button></div></div></aside> : null}
    {message ? <p className={`mt-4 font-semibold ${messageKind === "success" ? "text-green-800" : "text-red-700"}`}>{message}</p> : null}
  </div></main>;
}
