"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFreshSession } from "@/lib/auth-session";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabase } from "@/lib/supabase";

type Period = { id: string; display_name: string; display_order: number; period_type: "regular" | "playoff"; starts_at: string | null };

function easternDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Date pending";
}

export default function ArchivePage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadArchive() {
      const session = await getFreshSession();
      if (!session) { window.location.replace("/login"); return; }
      const { data: season, error: seasonError } = await supabase.from("seasons").select("id").eq("year", CURRENT_SEASON_YEAR).maybeSingle();
      if (seasonError || !season) { if (active) setError("The season archive could not be loaded."); return; }
      const { data, error: periodsError } = await supabase.from("scoring_periods").select("id, display_name, display_order, period_type, starts_at").eq("season_id", season.id).eq("status", "complete").order("display_order", { ascending: false });
      if (periodsError) { if (active) setError("The completed-week archive could not be loaded."); return; }
      if (active) setPeriods((data ?? []) as Period[]);
    }
    void loadArchive();
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-[#f7f3e8] px-6 py-10 text-zinc-900"><div className="mx-auto max-w-4xl">
    <header className="border-b-2 border-zinc-900 pb-6"><p className="text-xs font-black tracking-[0.16em] text-zinc-600">PERMANENT RECEIPTS</p><h1 className="mt-2 font-serif text-4xl font-bold">Week Archive</h1><p className="mt-2 max-w-2xl text-zinc-700">Every completed week retains its final slate, official lines, public pick receipts, results, and standings. Nothing here can be edited.</p></header>
    {error ? <p className="mt-6 font-semibold text-red-700">{error}</p> : null}
    {!error && periods.length === 0 ? <p className="mt-8 text-zinc-700">Completed weeks will appear here once the first slate is fully settled.</p> : null}
    <ol className="mt-6 grid gap-3 sm:grid-cols-2">{periods.map((period) => <li className="border border-zinc-400 bg-white p-4" key={period.id}><p className="text-xs font-black tracking-[0.14em] text-zinc-600">{period.period_type === "playoff" ? "PLAYOFF ROUND" : "REGULAR SEASON"}</p><h2 className="mt-1 font-serif text-2xl font-bold">{period.display_name}</h2><p className="mt-1 text-sm text-zinc-700">Began {easternDate(period.starts_at)}</p><Link className="mt-4 inline-block font-bold underline" href={`/board?week=${encodeURIComponent(period.id)}`}>Review final slate and receipts</Link></li>)}</ol>
  </div></main>;
}
