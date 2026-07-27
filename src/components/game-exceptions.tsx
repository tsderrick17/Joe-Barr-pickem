"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GameException = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  week: string;
  kickoffAt: string;
  status: "postponed" | "cancelled" | "pending_grade";
};

export default function GameExceptions() {
  const [exceptions, setExceptions] = useState<GameException[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function requestExceptions() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Please sign in before viewing game exceptions.");
    }

    const response = await fetch("/api/admin/game-exceptions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Game exceptions could not be loaded.");
    }

    return data.exceptions as GameException[];
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialExceptions() {
      try {
        const loadedExceptions = await requestExceptions();

        if (!cancelled) {
          setExceptions(loadedExceptions);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Game exceptions could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialExceptions();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadExceptions() {
    setErrorMessage("");
    setIsLoading(true);

    try {
      setExceptions(await requestExceptions());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Game exceptions could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="border-b-2 border-zinc-900 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold">Game Exceptions</h2>
          <p className="mt-2 text-zinc-700">
            Postponed, cancelled, and unresolved final-game picks are held for
            commissioner review.
          </p>
        </div>

        <button
          className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isLoading}
          onClick={loadExceptions}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-4 font-semibold text-red-700">{errorMessage}</p>
      ) : null}

      {exceptions?.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No game exceptions.</p>
      ) : null}

      {exceptions?.length ? (
        <ul className="mt-5 space-y-3">
          {exceptions.map((game) => (
            <li className="border border-amber-800 bg-amber-50 p-4" key={game.id}>
              <p className="font-bold uppercase tracking-wide text-amber-950">
                {game.status === "pending_grade"
                  ? "FINAL PICK AWAITING LINE OR GRADE"
                  : game.status}
              </p>
              <p className="mt-1 font-serif text-lg font-bold">
                {game.awayTeam} at {game.homeTeam}
              </p>
              <p className="mt-1 text-sm text-zinc-700">
                {game.week} · {new Date(game.kickoffAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
