"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  first_name: string;
  is_commissioner: boolean;
};

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPlayer() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("players")
        .select("first_name, is_commissioner")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      setPlayer(data);
      setIsLoading(false);
    }

    loadPlayer();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setPlayer(null);
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
              JOE BARR MEMORIAL
            </p>

            <h1 className="mt-2 font-serif text-4xl font-bold">
              Best Bets Pick&apos;em
            </h1>

            <p className="mt-2 text-zinc-700">
              Honor the tradition. Eliminate the paperwork.
            </p>
          </div>

          {!isLoading && player ? (
            <div className="text-right">
              <p className="font-bold">{player.first_name}</p>
              {player.is_commissioner && (
                <p className="text-sm text-zinc-600">Commissioner</p>
              )}
              <button
                className="mt-2 text-sm font-semibold underline"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          ) : !isLoading ? (
            <Link className="font-semibold underline" href="/login">
              Sign in
            </Link>
          ) : null}
        </header>

        <section className="mt-8">
          <h2 className="font-serif text-2xl font-bold">Standings</h2>
          <p className="mt-2 text-zinc-600">No season loaded.</p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-2xl font-bold">Current Week Picks</h2>
          <p className="mt-2 text-zinc-600">No games available.</p>
        </section>

        <section className="mt-8 border-t-2 border-zinc-900 pt-8">
          <h2 className="font-serif text-2xl font-bold">Survivor</h2>
          <p className="mt-2 text-zinc-600">No survivor entries.</p>
        </section>
      </div>
    </main>
  );
}