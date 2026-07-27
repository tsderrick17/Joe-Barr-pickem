"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  first_name: string;
  is_commissioner: boolean;
};

type ScoringPeriod = {
  display_name: string;
  status: "upcoming" | "active" | "complete";
};

export default function HomePage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHome() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("players")
        .select("first_name, is_commissioner")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      setPlayer(profile);

      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("year", 2026)
        .maybeSingle();

      if (season) {
        const { data: periods } = await supabase
          .from("scoring_periods")
          .select("display_name, status, display_order")
          .eq("season_id", season.id)
          .eq("period_type", "regular")
          .order("display_order");

        const currentWeek =
          periods?.find((period) => period.status === "active") ??
          periods?.find((period) => period.status === "upcoming") ??
          null;

        setWeek(currentWeek ?? null);
      }

      setIsLoading(false);
    }

    void loadHome();
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        Loading the pool…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e6] text-[#171719]">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
        <header className="border-b-2 border-[#1d1d1f] pb-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-sm font-bold tracking-[0.28em] text-slate-600">
                JOE BARR MEMORIAL
              </p>

              <h1 className="mt-3 font-serif text-4xl font-bold md:text-5xl">
                Best Bets Pick&apos;em
              </h1>

              <p className="mt-4 text-lg">
                Honor the tradition. Eliminate the paperwork.
              </p>
            </div>

            {player?.is_commissioner ? (
              <Link className="pt-2 font-bold underline" href="/admin">
                Commissioner
              </Link>
            ) : null}
          </div>
        </header>

        <section className="border-b-2 border-[#1d1d1f] py-8">
          <p className="text-sm font-bold tracking-[0.2em] text-slate-600">
            YOUR WEEK
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold">
            {week?.display_name ?? "Current Week"}
          </h2>

          <p className="mt-3 text-lg">
            {player?.first_name
              ? `${player.first_name}, make one pick now or save both at once.`
              : "Make your picks for the week."}
          </p>

          <Link
            className="mt-6 inline-block bg-[#1d1d1f] px-6 py-3 font-bold text-white"
            href="/board"
          >
            Go to The Board
          </Link>
        </section>

        <section className="border-b-2 border-[#1d1d1f] py-8">
          <p className="text-sm font-bold tracking-[0.2em] text-slate-600">
            STANDINGS
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold">
            Season standings
          </h2>

          <p className="mt-3 text-lg text-slate-700">
            Standings will update automatically as games become final.
          </p>
        </section>

        <section className="py-8">
          <p className="text-sm font-bold tracking-[0.2em] text-slate-600">
            SURVIVOR
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold">
            Regular-season Survivor
          </h2>

          <p className="mt-3 text-lg text-slate-700">
            Survivor will be added after the weekly Pick&apos;em flow is fully
            tested.
          </p>
        </section>
      </div>
    </main>
  );
}