"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScoringPeriod = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
  starts_at: string | null;
  ends_at: string | null;
};

type BoardGame = {
  id: string;
  kickoffAt: string;
  lineLockAt: string;
  awayTeam: string;
  homeTeam: string;
  favoriteTeamId: string | null;
  awayTeamId: string;
  homeTeamId: string;
};

function formatGameDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function formatEasternTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}

function getEasternDayKey(date: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function BoardPage() {
  const router = useRouter();

  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const gamesByDay = games.reduce<Record<string, BoardGame[]>>(
    (groups, game) => {
      const key = getEasternDayKey(game.kickoffAt);
      groups[key] ??= [];
      groups[key].push(game);
      return groups;
    },
    {},
  );

  useEffect(() => {
    async function loadBoard() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .select("id")
        .eq("year", 2026)
        .maybeSingle();

      if (seasonError || !season) {
        setErrorMessage("The 2026 season is not available yet.");
        setIsLoading(false);
        return;
      }

      const { data: periods, error: periodsError } = await supabase
        .from("scoring_periods")
        .select("id, display_name, display_order, status, starts_at, ends_at")
        .eq("season_id", season.id)
        .eq("period_type", "regular")
        .order("display_order");

      if (periodsError || !periods || periods.length === 0) {
        setErrorMessage("No regular-season weeks are available yet.");
        setIsLoading(false);
        return;
      }

      const now = new Date();

      const selectedWeek =
        periods.find((period) => period.status === "active") ??
        periods.find(
          (period) =>
            period.starts_at &&
            period.ends_at &&
            new Date(period.ends_at) > now,
        ) ??
        periods[0];

      setWeek(selectedWeek);

      const response = await fetch(
        `/api/board?scoringPeriodId=${selectedWeek.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error ?? "The board could not be loaded.");
        setIsLoading(false);
        return;
      }

      setGames(data.games);
      setIsLoading(false);
    }

    loadBoard();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
              JOE BARR MEMORIAL
            </p>

            <h1 className="mt-2 font-serif text-4xl font-bold">
              The Board
            </h1>

            <p className="mt-2 text-zinc-700">
              Honor the tradition. Eliminate the paperwork.
            </p>
          </div>

          <Link className="font-semibold underline" href="/">
            Standings
          </Link>
        </header>

        {isLoading ? (
          <p className="mt-10 text-zinc-700">Loading the board…</p>
        ) : null}

        {errorMessage ? (
          <p className="mt-10 font-semibold text-red-700">{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage && week ? (
          <section className="mt-8">
            <div className="border-b-2 border-zinc-900 pb-5">
              <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
                2026 REGULAR SEASON
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold">
                {week.display_name}
              </h2>

              <p className="mt-2 text-zinc-700">
                Choose two teams before their individual game locks.
                Official spreads appear at lock.
              </p>

              <p className="mt-3 text-sm font-semibold text-zinc-600">
                Current favorite listed first. Home team is shown in all caps.
              </p>
            </div>

            {games.length === 0 ? (
              <p className="mt-8 text-zinc-700">
                No games have been imported for this week yet.
              </p>
            ) : (
              <div className="mt-6 space-y-10">
                {Object.values(gamesByDay).map((dayGames) => {
                  const firstGame = dayGames[0];
                  const sharedLockTime = formatEasternTime(
                    firstGame.lineLockAt,
                  );

                  const allGamesShareDayLock = dayGames.every(
                    (game) =>
                      getEasternDayKey(game.kickoffAt) ===
                        getEasternDayKey(game.lineLockAt) &&
                      formatEasternTime(game.lineLockAt) === sharedLockTime,
                  );

                  return (
                    <section key={getEasternDayKey(firstGame.kickoffAt)}>
                      <div className="border-b border-zinc-400 pb-2">
                        <h3 className="text-sm font-bold tracking-[0.16em] text-zinc-700">
                          {formatGameDay(firstGame.kickoffAt).toUpperCase()}
                        </h3>

                        {allGamesShareDayLock ? (
                          <p className="mt-1 text-xs font-semibold tracking-wide text-zinc-600">
SPREADS APPEAR {sharedLockTime}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        {dayGames.map((game) => {
                          const isLocked =
                            new Date(game.lineLockAt) <= new Date();

                          const favoriteIsAway =
                            game.favoriteTeamId === game.awayTeamId;

                          const leftTeam = favoriteIsAway
                            ? game.awayTeam
                            : game.homeTeam;

                          const rightTeam = favoriteIsAway
                            ? game.homeTeam
                            : game.awayTeam;

                          const leftTeamIsHome = !favoriteIsAway;
                          const rightTeamIsHome = favoriteIsAway;

                          const hasEarlyLock =
                            getEasternDayKey(game.kickoffAt) !==
                            getEasternDayKey(game.lineLockAt);

                          return (
                            <article
                              className="border border-zinc-400 bg-white p-5"
                              key={game.id}
                            >
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <p
                                  className={`font-serif text-lg ${
                                    leftTeamIsHome ? "uppercase" : ""
                                  }`}
                                >
                                  {leftTeam}
                                </p>

                                <div className="text-center text-xs font-bold tracking-wide text-zinc-600">
                                  <p>{formatEasternTime(game.kickoffAt)}</p>

                                  {isLocked ? (
                                    <p className="mt-1">LOCKED</p>
                                  ) : hasEarlyLock ? (
                                    <p className="mt-1">
                                      EARLY GAME · SPREADS APPEAR{" "}
                                      {formatGameDay(game.lineLockAt)}{" "}
                                      {formatEasternTime(game.lineLockAt)}
                                    </p>
                                  ) : null}
                                </div>

                                <p
                                  className={`text-right font-serif text-lg ${
                                    rightTeamIsHome ? "uppercase" : ""
                                  }`}
                                >
                                  {rightTeam}
                                </p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}