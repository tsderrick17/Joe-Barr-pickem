"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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
  usedTeamIds: string[];
  byeTeams: string[];
  games: Game[];
  error?: string;
};

const helmetColors: Record<string, string> = {
  ARI: "#ffffff", ATL: "#111111", BAL: "#111111", BUF: "#ffffff", CAR: "#bfc0bf", CHI: "#0b162a", CIN: "#fb4f14", CLE: "#ff3c00", DAL: "#b0b7bc", DEN: "#0a2343", DET: "#b0b7bc", GB: "#ffb612", HOU: "#03202f", IND: "#ffffff", JAX: "#111111", KC: "#e31837", LV: "#a5acaf", LAC: "#ffffff", LAR: "#003594", MIA: "#ffffff", MIN: "#4f2683", NE: "#c5c9cc", NO: "#d3bc8d", NYG: "#0b2265", NYJ: "#125740", PHI: "#004c54", PIT: "#111111", SEA: "#002244", SF: "#b3995d", TB: "#5b6062", TEN: "#0c2340", WAS: "#5a1414",
};

function Helmet({ team, faces, unavailable }: { team: Team; faces: "left" | "right"; unavailable?: boolean }) {
  const flipped = faces === "left";
  const mask = "url(/helmet-newspaper-template.png)";
  const logoScale = team.abbreviation === "BUF" ? "scale-110" : "";

  return <span aria-hidden="true" className={`relative block h-12 w-16 shrink-0 ${flipped ? "-scale-x-100" : ""} ${unavailable ? "grayscale opacity-55" : ""}`}>
    <span className="absolute inset-0" style={{ backgroundColor: helmetColors[team.abbreviation] ?? "#fff", maskImage: mask, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center", WebkitMaskImage: mask, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center" }} />
    <span className="absolute inset-0" style={{ backgroundColor: "#fff", clipPath: "polygon(27% 57%, 100% 57%, 100% 100%, 27% 100%)", maskImage: mask, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center", WebkitMaskImage: mask, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center" }} />
    <span className="absolute inset-0" style={{ backgroundColor: "#fff", clipPath: "polygon(53% 29%, 100% 29%, 100% 62%, 69% 62%, 59% 53%, 52% 48%)", maskImage: mask, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center", WebkitMaskImage: mask, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center" }} />
    <Image alt="" className="absolute inset-0 h-full w-full object-contain mix-blend-multiply" height={48} src="/helmet-newspaper-template.png" width={64} />
    <span className={`absolute left-[15%] top-[18%] h-[42%] w-[40%] ${flipped ? "-scale-x-100" : ""}`}><Image alt="" className={`h-full w-full object-contain ${logoScale}`} height={28} src={`/team-logos/${team.abbreviation}.png`} width={28} /></span>
  </span>;
}

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
  const currentPick = data.entry.pick && data.games.flatMap((game) => [game.awayTeam, game.homeTeam]).find((team) => team.id === data.entry.pick?.selected_team_id);

  return <main className="min-h-screen bg-[#f5f0e6] px-4 py-5 text-[#171719] sm:px-5 sm:py-8 md:px-10"><div className="mx-auto max-w-3xl">
    <header className="border-b-4 border-[#171719] pb-4"><p className="text-[11px] font-bold tracking-[.22em] text-slate-600">STRAIGHT-UP SURVIVOR · {data.week.name.toUpperCase()}</p><h1 className="mt-1 font-serif text-4xl font-black tracking-tight sm:text-5xl">The Survivor Wire</h1><p className="mt-2 max-w-xl text-sm text-slate-700">Pick one outright winner. Each team may be used once per season.</p>{data.byeTeams.length ? <p className="mt-3 text-[11px] font-bold tracking-[.12em] text-slate-600">BYE THIS WEEK: {data.byeTeams.join(", ")}</p> : null}</header>
    {eliminated ? <section className="mt-5 border-l-4 border-[#171719] bg-[#e7e1d5] px-4 py-3"><p className="text-xs font-black tracking-[.16em] text-zinc-600">SURVIVOR STATUS</p><h2 className="mt-1 font-serif text-2xl font-black">You have been eliminated.</h2><p className="mt-1 text-sm">The matchups remain available to follow the pool, but your entry is closed.</p></section> : <section className="mt-5 border-l-4 border-green-800 bg-[#edf7ef] px-4 py-3 text-green-950"><p className="font-bold">{currentPick ? `Your ${data.week.name} pick: ${currentPick.name}` : "A Survivor pick is due this week."}</p><p className="mt-1 text-sm">You may change it until that matchup begins.</p></section>}
    <section className={`mt-7 border-t-4 border-[#171719] ${eliminated ? "grayscale" : ""}`}><div className="flex items-center justify-between border-b border-[#171719] py-3"><h2 className="font-serif text-2xl font-black">This week&apos;s matchups</h2><span className="text-[11px] font-bold tracking-[.16em] text-slate-600">{eliminated ? "VIEW ONLY" : "SELECT ONE"}</span></div><div className="divide-y divide-[#c9c1b2]">
      {data.games.map((game) => { const started = new Date(game.kickoffAt) <= new Date(); const teams: Array<{ team: Team; faces: "left" | "right" }> = [{ team: game.awayTeam, faces: "right" }, { team: game.homeTeam, faces: "left" }]; return <article className="relative bg-[#fbfaf7] py-1" key={game.id}><span className="absolute inset-x-0 top-0 h-1" style={{ backgroundImage: `linear-gradient(90deg, ${helmetColors[game.awayTeam.abbreviation] ?? "#111"} 0 50%, ${helmetColors[game.homeTeam.abbreviation] ?? "#111"} 50% 100%)` }} /><div className="grid grid-cols-2 divide-x divide-[#d1c9ba]">{teams.map(({ team, faces }) => { const chosen = selected?.teamId === team.id; const unavailable = isSurvivorTeamUnavailable({ teamId: team.id, usedTeamIds: data.usedTeamIds, savedPickTeamId: data.entry.pick?.selected_team_id ?? null, gameStarted: started, entryEliminated: eliminated }); return <button aria-label={`Choose ${team.name}`} aria-pressed={chosen} className={`flex min-h-16 items-center justify-center gap-2 px-3 py-2 text-left transition ${chosen ? "bg-[#e8e0d0] ring-2 ring-inset ring-[#171719]" : "hover:bg-[#f2eee6]"} disabled:cursor-not-allowed`} disabled={unavailable} key={team.id} onClick={() => setSelected(chosen ? null : { gameId: game.id, teamId: team.id })} title={unavailable ? `${team.name} is unavailable` : `Choose ${team.name}`} type="button"><Helmet team={team} faces={faces} unavailable={unavailable} /><span className="max-w-24 text-xs font-bold leading-4 text-zinc-800">{team.name}</span></button>; })}</div></article>; })}
    </div></section>
    {!eliminated ? <button className="mt-6 min-h-12 bg-[#1d1d1f] px-6 py-3 font-bold text-white disabled:opacity-50" disabled={saving || !selected} onClick={save} type="button">{saving ? "Saving..." : currentPick ? "Update Survivor pick" : "Save Survivor pick"}</button> : null}
    {message ? <p className={`mt-4 font-semibold ${messageKind === "success" ? "text-green-800" : "text-red-700"}`}>{message}</p> : null}
  </div></main>;
}
