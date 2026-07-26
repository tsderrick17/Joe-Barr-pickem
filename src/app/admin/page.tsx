"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Spread = {
  team: string;
  spread: number | null;
};

type BookmakerSpread = {
  source: string;
  outcomes: Spread[];
};

type OddsEvent = {
  id: string;
  kickoffAt: string;
  awayTeam: string;
  homeTeam: string;
  bookmakerSpreads: BookmakerSpread[];
};

type OddsPreview = {
  requestsRemaining: string | null;
  events: OddsEvent[];
};

export default function AdminPage() {
  const [preview, setPreview] = useState<OddsPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function previewOdds() {
    setErrorMessage("");
    setIsLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setErrorMessage("Please sign in before checking the odds feed.");
      setIsLoading(false);
      return;
    }

    const response = await fetch("/api/admin/odds-preview", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setErrorMessage(data.error ?? "The odds preview could not load.");
      setIsLoading(false);
      return;
    }

    setPreview(data);
    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
              COMMISSIONER
            </p>

            <h1 className="mt-2 font-serif text-4xl font-bold">
              System Health
            </h1>

            <p className="mt-2 text-zinc-700">
              Check the live NFL data source before automation is turned on.
            </p>
          </div>

          <Link className="font-semibold underline" href="/">
            Back to pool
          </Link>
        </header>

        <section className="mt-8 border-y-2 border-zinc-900 py-8">
          <h2 className="font-serif text-2xl font-bold">Odds Feed</h2>

          <p className="mt-2 text-zinc-700">
            This is a read-only preview. It does not add games or lock lines.
          </p>

          <button
            className="mt-5 bg-zinc-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading}
            onClick={previewOdds}
          >
            {isLoading ? "Checking feed..." : "Check NFL odds feed"}
          </button>

          {errorMessage ? (
            <p className="mt-4 font-semibold text-red-700">{errorMessage}</p>
          ) : null}

          {preview ? (
            <div className="mt-8">
              <p className="text-sm text-zinc-600">
                API requests remaining this month:{" "}
                <span className="font-bold">
                  {preview.requestsRemaining ?? "Not reported"}
                </span>
              </p>

              {preview.events.length === 0 ? (
                <p className="mt-4 text-zinc-700">
                  No NFL games are listed right now.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {preview.events.map((event) => {
                    const exampleLine = event.bookmakerSpreads.find(
                      (bookmaker) => bookmaker.outcomes.length === 2,
                    );

                    return (
                      <article
                        className="border border-zinc-400 bg-white p-4"
                        key={event.id}
                      >
                        <p className="text-sm text-zinc-600">
                          {new Date(event.kickoffAt).toLocaleString()}
                        </p>

                        <h3 className="mt-1 font-serif text-xl font-bold">
                          {event.awayTeam} at {event.homeTeam}
                        </h3>

                        {exampleLine ? (
                          <p className="mt-2 text-sm">
                            Example line from{" "}
                            <span className="font-semibold">
                              {exampleLine.source}
                            </span>
                            :{" "}
                            {exampleLine.outcomes
                              .map((outcome) => {
                                const sign =
                                  outcome.spread !== null &&
                                  outcome.spread > 0
                                    ? "+"
                                    : "";

                                return `${outcome.team} ${sign}${outcome.spread}`;
                              })
                              .join(" · ")}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-600">
                            No spread is currently available.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}