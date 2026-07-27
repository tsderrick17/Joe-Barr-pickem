"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ScoringPeriod = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
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

type SelectedPick = {
  gameId: string;
  teamId: string;
};

type BoardResponse = {
  games: BoardGame[];
  myPicks: SelectedPick[];
  error?: string;
};

function easternDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function easternTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function isEarlyGame(game: BoardGame) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(game.kickoffAt)),
  );

  return hour < 12;
}

function teamLabel(teamName: string, isHome: boolean) {
  return isHome ? teamName.toUpperCase() : teamName;
}

export default function BoardPage() {
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionWarning, setSelectionWarning] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");

  useEffect(() => {
    async function loadBoard() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .select("id")
        .eq("year", 2026)
        .maybeSingle();

      if (seasonError || !season) {
        setErrorMessage("The current season could not be loaded.");
        setIsLoading(false);
        return;
      }

      const { data: periods, error: periodsError } = await supabase
        .from("scoring_periods")
        .select("id, display_name, display_order, status")
        .eq("season_id", season.id)
        .eq("period_type", "regular")
        .order("display_order");

      if (periodsError || !periods?.length) {
        setErrorMessage("The weekly schedule could not be loaded.");
        setIsLoading(false);
        return;
      }

      const currentWeek =
        periods.find((period) => period.status === "active") ??
        periods.find((period) => period.status === "upcoming") ??
        periods[0];

      setWeek(currentWeek);

      const response = await fetch(`/api/board?scoringPeriodId=${currentWeek.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = (await response.json()) as BoardResponse;

      if (!response.ok) {
        setErrorMessage(data.error ?? "The Board could not be loaded.");
        setIsLoading(false);
        return;
      }

      setGames(data.games);
      setSelectedPicks(data.myPicks);
      setIsLoading(false);
    }

    void loadBoard();
  }, []);

  const gamesByDay = useMemo(() => {
    const grouped = new Map<string, BoardGame[]>();

    for (const game of games) {
      const day = easternDate(game.kickoffAt);

      if (!grouped.has(day)) {
        grouped.set(day, []);
      }

      grouped.get(day)?.push(game);
    }

    return Array.from(grouped.entries());
  }, [games]);

  const selectedTeamNames = useMemo(() => {
    return selectedPicks
      .map((pick) => {
        const game = games.find((item) => item.id === pick.gameId);

        if (!game) return null;
        if (pick.teamId === game.homeTeamId) return game.homeTeam;
        if (pick.teamId === game.awayTeamId) return game.awayTeam;

        return null;
      })
      .filter(Boolean) as string[];
  }, [games, selectedPicks]);

  function isSelected(gameId: string, teamId: string) {
    return selectedPicks.some(
      (pick) => pick.gameId === gameId && pick.teamId === teamId,
    );
  }

  function chooseTeam(gameId: string, teamId: string) {
    setSelectionWarning("");
    setSubmissionMessage("");

    const existingPick = selectedPicks.find((pick) => pick.gameId === gameId);

    if (existingPick?.teamId === teamId) {
      setSelectedPicks((current) =>
        current.filter((pick) => pick.gameId !== gameId),
      );
      return;
    }

    if (existingPick) {
      setSelectedPicks((current) =>
        current.map((pick) =>
          pick.gameId === gameId ? { gameId, teamId } : pick,
        ),
      );
      return;
    }

    if (selectedPicks.length >= 2) {
      setSelectionWarning(
        "You already have two selections. Click a selected team again to remove it first.",
      );
      return;
    }

    setSelectedPicks((current) => [...current, { gameId, teamId }]);
  }

  async function submitPicks() {
    setSelectionWarning("");
    setSubmissionMessage("");

    if (!week || selectedPicks.length < 1) {
      setSelectionWarning("Choose at least one team before saving.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/picks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        scoringPeriodId: week.id,
        selections: selectedPicks,
      }),
    });

    const data = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSelectionWarning(
        data.error ?? "Your picks could not be saved. Please try again.",
      );
      return;
    }

    setSubmissionMessage(data.message ?? "Your pick has been saved.");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-6 text-[#171719]">
        Loading The Board…
      </main>
    );
  }

  if (errorMessage || !week) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-6 text-[#171719]">
        <h1 className="font-serif text-4xl">The Board</h1>
        <p className="mt-4 font-semibold text-red-700">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e6] pb-52 text-[#171719]">
      <div className="mx-auto max-w-6xl px-5 py-9 md:px-10">
        <header className="border-b-2 border-[#1d1d1f] pb-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold tracking-[0.28em] text-slate-600">
                JOE BARR MEMORIAL
              </p>
              <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">
                The Board
              </h1>
              <p className="mt-3 text-lg">
                {week.display_name} · Choose up to two teams.
              </p>
            </div>

            <Link className="pt-2 font-bold underline" href="/">
              Standings
            </Link>
          </div>

          <div className="mt-5 text-sm leading-6 text-slate-700">
            <p>Teams on the left are preliminary favorites. Home teams are in ALL CAPS.</p>
            <p>Click a team to select it. Spreads appear at the stated lock time.</p>
          </div>
        </header>

        <div className="mt-8 space-y-10">
          {gamesByDay.map(([day, dayGames]) => {
            const normalLock = dayGames.find((game) => !isEarlyGame(game));

            return (
              <section key={day}>
                <div className="border-b border-slate-400 pb-3">
                  <h2 className="font-bold tracking-[0.18em]">
                    {day.toUpperCase()}
                  </h2>

                  {normalLock ? (
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      SPREADS APPEAR {easternTime(normalLock.lineLockAt)}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {dayGames.map((game) => {
                    const favoriteIsHome =
                      game.favoriteTeamId === game.homeTeamId;

                    const leftTeamName = favoriteIsHome
                      ? game.homeTeam
                      : game.awayTeam;

                    const leftTeamId = favoriteIsHome
                      ? game.homeTeamId
                      : game.awayTeamId;

                    const rightTeamName = favoriteIsHome
                      ? game.awayTeam
                      : game.homeTeam;

                    const rightTeamId = favoriteIsHome
                      ? game.awayTeamId
                      : game.homeTeamId;

                    return (
                      <article
                        className="border border-slate-400 bg-white"
                        key={game.id}
                      >
                        <div className="grid min-h-24 grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 md:px-7">
                          <button
                            className={`text-left font-serif text-lg leading-tight md:text-2xl ${
                              isSelected(game.id, leftTeamId)
                                ? "bg-[#1d1d1f] px-3 py-2 text-white"
                                : "hover:underline"
                            }`}
                            onClick={() => chooseTeam(game.id, leftTeamId)}
                            type="button"
                          >
                            {teamLabel(leftTeamName, favoriteIsHome)}
                          </button>

                          <div className="min-w-24 text-center text-xs font-bold leading-5 text-slate-700 md:min-w-36">
                            <p>{easternTime(game.kickoffAt)}</p>
                            {isEarlyGame(game) ? (
                              <p className="mt-1">
                                EARLY GAME · SPREADS APPEAR{" "}
                                {easternTime(game.lineLockAt)}
                              </p>
                            ) : null}
                          </div>

                          <button
                            className={`text-right font-serif text-lg leading-tight md:text-2xl ${
                              isSelected(game.id, rightTeamId)
                                ? "bg-[#1d1d1f] px-3 py-2 text-white"
                                : "hover:underline"
                            }`}
                            onClick={() => chooseTeam(game.id, rightTeamId)}
                            type="button"
                          >
                            {teamLabel(rightTeamName, !favoriteIsHome)}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <aside className="fixed inset-x-0 bottom-0 border-t-2 border-[#1d1d1f] bg-[#f5f0e6] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="mx-auto max-w-6xl px-5 py-4 md:px-10">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="font-bold">
                {selectedPicks.length} of 2 picks selected
              </p>

              <p className="mt-1 text-sm text-slate-700">
                {selectedTeamNames.length
                  ? selectedTeamNames.join(" · ")
                  : "Click a team above to make a selection."}
              </p>

              {selectionWarning ? (
                <p className="mt-2 font-semibold text-red-700">
                  {selectionWarning}
                </p>
              ) : null}

              {submissionMessage ? (
                <p className="mt-2 font-semibold text-green-800">
                  {submissionMessage}
                </p>
              ) : null}
            </div>

            <button
              className="min-h-12 bg-[#1d1d1f] px-6 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={selectedPicks.length < 1 || isSubmitting}
              onClick={submitPicks}
              type="button"
            >
              {isSubmitting
                ? "Saving…"
                : selectedPicks.length === 1
                  ? "Save 1 pick"
                  : "Save 2 picks"}
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}