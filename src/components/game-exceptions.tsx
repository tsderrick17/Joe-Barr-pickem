"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GameException = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  week: string;
  kickoffAt: string;
  status: "postponed" | "cancelled" | "no_contest" | "pending_grade";
};

type RecordableGame = Omit<GameException, "status">;

export default function GameExceptions() {
  const [exceptions, setExceptions] = useState<GameException[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [recordableGames, setRecordableGames] = useState<RecordableGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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

    return data as { exceptions: GameException[]; recordableGames: RecordableGame[] };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialExceptions() {
      try {
        const loadedExceptions = await requestExceptions();

        if (!cancelled) {
          setExceptions(loadedExceptions.exceptions);
          setRecordableGames(loadedExceptions.recordableGames);
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
      const loadedExceptions = await requestExceptions();
      setExceptions(loadedExceptions.exceptions);
      setRecordableGames(loadedExceptions.recordableGames);
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

  async function recordDisruption(status: "postponed" | "cancelled" | "no_contest") {
    if (!selectedGameId) return;
    const selectedGame = recordableGames.find((game) => game.id === selectedGameId);
    if (!selectedGame || !window.confirm(`Record ${selectedGame.awayTeam} at ${selectedGame.homeTeam} as ${status}? Pending picks will be voided immediately and remain in the audit history.`)) return;

    setErrorMessage("");
    setSuccessMessage("");
    setIsRecording(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in before recording a game disruption.");
      const response = await fetch("/api/admin/game-disruptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGameId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The disruption could not be recorded.");
      setSuccessMessage(data.message);
      setSelectedGameId("");
      await loadExceptions();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The disruption could not be recorded.");
    } finally {
      setIsRecording(false);
    }
  }

  return (
    <section className="border-b-2 border-zinc-900 py-8" id="game-exceptions">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold">Game Exceptions</h2>
          <p className="mt-2 text-zinc-700">
            Record a verified postponement, cancellation, or no contest here.
            Pending picks are retained in the audit trail and settled by the
            published pool rules.
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
      {successMessage ? <p className="mt-4 font-semibold text-green-800">{successMessage}</p> : null}

      {recordableGames.length ? (
        <div className="mt-5 border border-zinc-400 bg-white p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-zinc-700">Record verified disruption</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select className="min-w-64 border border-zinc-900 bg-white px-3 py-2" value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}>
              <option value="">Choose a scheduled or live game</option>
              {recordableGames.map((game) => <option key={game.id} value={game.id}>{game.week} · {game.awayTeam} at {game.homeTeam}</option>)}
            </select>
            <button className="border border-amber-800 px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-40" disabled={!selectedGameId || isRecording} onClick={() => void recordDisruption("postponed")} type="button">Mark postponed</button>
            <button className="bg-red-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={!selectedGameId || isRecording} onClick={() => void recordDisruption("cancelled")} type="button">Mark cancelled</button>
            <button className="border border-red-800 px-3 py-2 text-sm font-bold text-red-900 disabled:opacity-40" disabled={!selectedGameId || isRecording} onClick={() => void recordDisruption("no_contest")} type="button">Declare no contest</button>
          </div>
        </div>
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
