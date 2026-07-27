"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Game = { id: string; kickoffAt: string; status: string; awayTeamId: string; homeTeamId: string; awayTeam: string; homeTeam: string };
type Pick = { game_id: string; selected_team_id: string; result: string } | null;
type Data = { week: { name: string; status: string }; entry: { status: string; pick: Pick }; usedTeamIds: string[]; games: Game[]; entries: { id: string; name: string; status: string }[]; error?: string };

function kickoff(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

export default function SurvivorPage() {
  const [data, setData] = useState<Data | null>(null);
  const [selection, setSelection] = useState<{ gameId: string; teamId: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    const response = await fetch("/api/survivor", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = (await response.json()) as Data;
    if (!response.ok) { setNotice(result.error ?? "Survivor could not be loaded."); setLoading(false); return; }
    setData(result);
    setSelection(result.entry.pick ? { gameId: result.entry.pick.game_id, teamId: result.entry.pick.selected_team_id } : null);
    setLoading(false);
  }

  useEffect(() => {
    // The authenticated request resolves asynchronously, then populates the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  const selectedName = useMemo(() => {
    const game = data?.games.find((item) => item.id === selection?.gameId);
    if (!game || !selection) return null;
    return selection.teamId === game.awayTeamId ? game.awayTeam : game.homeTeam;
  }, [data, selection]);

  async function save() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    setSaving(true); setNotice("");
    const response = await fetch("/api/survivor", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(selection ? { gameId: selection.gameId, teamId: selection.teamId } : {}) });
    const result = await response.json() as { error?: string; message?: string };
    setSaving(false);
    setNotice(response.ok ? result.message ?? "Saved." : result.error ?? "Your Survivor pick could not be saved.");
    if (response.ok) await load();
  }

  if (loading) return <main className="min-h-screen bg-[#f5f0e6] p-6 text-[#171719]">Loading Survivor…</main>;

  const canPick = data?.entry.status === "active" && data.week.status !== "complete";
  return <main className="min-h-screen bg-[#f5f0e6] pb-36 text-[#171719]">
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8 md:px-10">
      <header className="border-b-2 border-[#1d1d1f] pb-5">
        <p className="text-xs font-bold tracking-[0.2em] text-slate-600">ONE TEAM · ONE TIME</p>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">Survivor</h1>
        <p className="mt-3 max-w-xl text-sm leading-5 text-slate-700">Pick one team to win outright each week. You cannot use that team again. Losses and ties eliminate you.</p>
      </header>
      {notice ? <p className={`mt-5 font-semibold ${notice.includes("saved") || notice.includes("cleared") ? "text-green-800" : "text-red-700"}`}>{notice}</p> : null}
      {data ? <>
        <section className="mt-6 border-b-2 border-[#1d1d1f] pb-5"><p className="text-xs font-bold tracking-[0.16em] text-slate-600">THIS WEEK</p><h2 className="mt-1 font-serif text-2xl font-bold">{data.week.name}</h2><p className="mt-2 font-semibold">{data.entry.status === "active" ? selectedName ? `Your pick: ${selectedName}` : "You still need a Survivor pick." : "Your Survivor entry has been eliminated."}</p></section>
        <section className="mt-6"><h2 className="font-serif text-2xl font-bold">Choose a winner</h2><div className="mt-3 divide-y-2 divide-[#91afd0] border-y-2 border-[#1d1d1f]">
          {data.games.map((game) => { const started = new Date(game.kickoffAt) <= new Date(); const awayUsed = data.usedTeamIds.includes(game.awayTeamId) && selection?.teamId !== game.awayTeamId; const homeUsed = data.usedTeamIds.includes(game.homeTeamId) && selection?.teamId !== game.homeTeamId; return <article className="py-3" key={game.id}><p className="mb-2 text-xs font-bold text-slate-600">{kickoff(game.kickoffAt)}</p><div className="grid grid-cols-2 gap-2"><button disabled={!canPick || started || awayUsed} onClick={() => setSelection({ gameId: game.id, teamId: game.awayTeamId })} className={`min-h-12 border border-[#1d1d1f] px-3 font-serif text-base disabled:opacity-50 ${selection?.gameId === game.id && selection.teamId === game.awayTeamId ? "bg-[#1d1d1f] text-white" : "bg-white"}`}>{game.awayTeam}{awayUsed ? " — USED" : ""}</button><button disabled={!canPick || started || homeUsed} onClick={() => setSelection({ gameId: game.id, teamId: game.homeTeamId })} className={`min-h-12 border border-[#1d1d1f] px-3 font-serif text-base disabled:opacity-50 ${selection?.gameId === game.id && selection.teamId === game.homeTeamId ? "bg-[#1d1d1f] text-white" : "bg-white"}`}>{game.homeTeam.toUpperCase()}{homeUsed ? " — USED" : ""}</button></div></article>; })}
        </div></section>
        <section className="mt-8"><h2 className="font-serif text-2xl font-bold">Survivor standings</h2><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y-2 border-[#1d1d1f] py-3 sm:grid-cols-3">{data.entries.map((entry) => <p key={entry.id} className={entry.status === "active" ? "font-semibold" : "text-slate-500 line-through"}>{entry.name} <span className="text-xs font-bold">{entry.status === "active" ? "ACTIVE" : "OUT"}</span></p>)}</div></section>
      </> : null}
    </div>
    {canPick ? <aside className="fixed inset-x-0 bottom-0 border-t-2 border-[#1d1d1f] bg-[#f5f0e6] p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.1)]"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-1 sm:px-5"><p className="text-sm font-semibold">{selectedName ?? "Choose one team"}</p><button disabled={saving} onClick={save} className="min-h-12 bg-[#1d1d1f] px-5 font-bold text-white disabled:bg-slate-400">{saving ? "Saving…" : selection ? "Save Survivor pick" : "Clear pick"}</button></div></aside> : null}
  </main>;
}
