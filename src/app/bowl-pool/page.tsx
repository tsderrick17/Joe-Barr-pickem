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
        <section className="mt-6 border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-bold">Bowl Pool foundation ready</h2>
          <p className="mt-2 max-w-2xl text-slate-700">This annual, voluntary competition covers every FBS bowl and playoff matchup against the spread. The selections workspace will appear here when the bowl schedule is published.</p>
          {profile?.isCommissioner && !hasLaunched ? <p className="mt-4 text-sm font-semibold text-slate-600">Commissioner preview · player access opens December 7 at 3:00 AM Eastern.</p> : null}
        </section>
      ) : null}
    </main>
  );
}
