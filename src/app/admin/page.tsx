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

type ImportGame = {
  externalGameId: string;
  kickoff: string;
  awayTeam: string;
  homeTeam: string;
  spread: Array<{
    team: string;
    point: number | null;
  }>;
};

type ImportPreview = {
  commissioner: string;
  requestsRemaining: string | null;
  games: ImportGame[];
  note: string;
};

export default function AdminPage() {
  const [preview, setPreview] = useState<OddsPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [importPreview, setImportPreview] =
    useState<ImportPreview | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState("");
  const [isImportLoading, setIsImportLoading] = useState(false);

  async function getSessionToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async function previewOdds() {
    setErrorMessage("");
    setIsLoading(true);

    const accessToken = await getSessionToken();

    if (!accessToken) {
      setErrorMessage("Please sign in before checking the odds feed.");
      setIsLoading(false);
      return;
    }

    const response = await fetch("/api/admin/odds-preview", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

  async function previewImport() {
    setImportErrorMessage("");
    setIsImportLoading(true);

    const accessToken = await getSessionToken();

    if (!accessToken) {
      setImportErrorMessage("Please sign in before previewing an import.");
      setIsImportLoading(false);
      return;
    }

    const response = await fetch("/api/admin/import-preview", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setImportErrorMessage(
        data.error ?? "The import preview could not load.",
      );
      setIsImportLoading(false);
      return;
    }

    setImportPreview(data);
    setIsImportLoading(false);
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
                              .join(" / ")}
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

        <section className="border-b-2 border-zinc-900 py-8">
          <h2 className="font-serif text-2xl font-bold">Import Preview</h2>

          <p className="mt-2 text-zinc-700">
            Review the exact games and DraftKings spreads the automated importer
            will use. This still does not write anything to the database.
          </p>

          <button
            className="mt-5 bg-zinc-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isImportLoading}
            onClick={previewImport}
          >
            {isImportLoading
              ? "Preparing preview..."
              : "Preview game import"}
          </button>

          {importErrorMessage ? (
            <p className="mt-4 font-semibold text-red-700">
              {importErrorMessage}
            </p>
          ) : null}

          {importPreview ? (
            <div className="mt-8">
              <p className="text-zinc-700">
                Signed in as Commissioner {importPreview.commissioner}.{" "}
                {importPreview.note}
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                Live games found:{" "}
                <span className="font-bold">{importPreview.games.length}</span>
                {" · "}API requests remaining:{" "}
                <span className="font-bold">
                  {importPreview.requestsRemaining ?? "Not reported"}
                </span>
              </p>

              {importPreview.games.length === 0 ? (
                <p className="mt-4 text-zinc-700">
                  No NFL games are currently available to preview.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {importPreview.games.map((game) => (
                    <article
                      className="border border-zinc-400 bg-white p-4"
                      key={game.externalGameId}
                    >
                      <p className="text-sm text-zinc-600">
                        {new Date(game.kickoff).toLocaleString()}
                      </p>

                      <h3 className="mt-1 font-serif text-xl font-bold">
                        {game.awayTeam} at {game.homeTeam}
                      </h3>

                      {game.spread.length === 2 ? (
                        <p className="mt-2 text-sm">
                          DraftKings:{" "}
                          {game.spread
                            .map((outcome) => {
                              const sign =
                                outcome.point !== null && outcome.point > 0
                                  ? "+"
                                  : "";

                              return `${outcome.team} ${sign}${outcome.point}`;
                            })
                            .join(" / ")}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-600">
                          DraftKings has not posted a spread for this game yet.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}