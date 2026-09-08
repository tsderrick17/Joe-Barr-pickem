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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasLaunched(Date.now() >= Date.parse(bowlPoolLaunchAt(CURRENT_SEASON_YEAR)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
          <div className="mt-5 overflow-hidden border border-slate-300">
            <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(4rem,6rem)_minmax(7rem,1fr)] bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 sm:px-4">
              <span>Favorite</span><span className="text-center">Line</span><span className="text-right">Underdog</span>
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div className="grid min-h-14 grid-cols-[minmax(7rem,1fr)_minmax(4rem,6rem)_minmax(7rem,1fr)] items-center border-t border-slate-200 px-3 text-slate-400 sm:px-4" key={index}>
                <span className="h-5 max-w-32 rounded-sm border border-dashed border-slate-300" aria-label="Blank favorite team" />
                <span className="mx-auto h-5 w-10 rounded-sm border border-dashed border-slate-300" aria-label="Blank spread" />
                <span className="ml-auto h-5 max-w-32 rounded-sm border border-dashed border-slate-300" aria-label="Blank underdog team" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Commissioner preview only. The live schedule importer will replace these blank rows without changing the Bowl Pool rules or NFL picks.</p>
          {profile?.isCommissioner && !hasLaunched ? <p className="mt-4 text-sm font-semibold text-slate-600">Commissioner preview · player access opens December 7 at 3:00 AM Eastern.</p> : null}
        </section>
      ) : null}
    </main>
  );
}
