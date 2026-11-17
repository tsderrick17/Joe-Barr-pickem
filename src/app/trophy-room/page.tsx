"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import AllTimeTable, { type AllTimeRow } from "@/components/all-time-table";
import TrophyTurntable from "@/components/trophy-turntable";

type Champion = { playerId: string; name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };
type Row = AllTimeRow;

export default function TrophyRoomPage() {
  const [data, setData] = useState<{ trophies: Season[]; players: Row[] } | null>(null);
  const [notYet, setNotYet] = useState(false);   // before the Trophy Room opens, a player is told when
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const response = await fetchWithSession("/api/trophy-room");
        const body = await response.json() as { trophies?: Season[]; players?: Row[]; error?: string };
        if (response.status === 404) { if (!disposed) setNotYet(true); return; }
        if (!response.ok) throw new Error(body.error ?? "The Trophy Room could not be loaded.");
        if (!disposed) setData({ trophies: body.trophies ?? [], players: body.players ?? [] });
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setError(reason instanceof Error ? reason.message : "The Trophy Room could not be loaded.");
      }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  return (
    <main className="commissioner-subpage min-h-screen px-4 py-7 text-(color:--themed-text-31) sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4 desk-rule-bottom pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-(color:--themed-text-28)">LEAD PIPE LOCKS</p>
            <h1 className="mt-2 font-serif text-4xl font-bold">Trophy Room</h1>
          </div>
          <Link className="font-bold underline underline-offset-4" href="/">Back to Standings</Link>
        </header>

        {error ? <p className="mt-6 font-semibold text-red-700" role="alert">{error}</p> : null}
        {notYet ? <p className="mt-6 text-lg">The Trophy Room is not open yet.</p> : null}
        {!data && !error && !notYet ? <p className="mt-6 text-sm text-(color:--themed-text-28)">Loading the Trophy Room…</p> : null}

        <section aria-labelledby="trophy-display" className="desk-rule-bottom py-8">
          <h2 className="sr-only" id="trophy-display">The trophies</h2>
          <div><TrophyTurntable seasons={data?.trophies ?? null} /></div>
        </section>

        {data ? <>
          <AllTimeTable players={data.players} />
        </> : null}

      </div>
    </main>
  );
}
