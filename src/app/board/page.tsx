"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ScoringPeriod = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
  period_type: "regular" | "playoff";
  max_picks: number;
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
  officialSpread: number | null;
  spreadSource: string | null;
  spreadLockedAt: string | null;
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
function officialSpreadLabel(spread: number | null) {
  if (spread === null) return null;
  if (spread === 0) return "PK";

  return `-${Number.isInteger(spread) ? spread : spread.toFixed(1)}`;
}

export default function BoardPage() {
  const [weeks, setWeeks] = useState<ScoringPeriod[]>([]);
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionWarning, setSelectionWarning] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");

  async function loadWeek(period: ScoringPeriod, accessToken: string) {
    setIsLoading(true);
    setErrorMessage("");
    setSelectionWarning("");
    setSubmissionMessage("");
    setWeek(period);

    const response = await fetch(`/api/board?scoringPeriodId=${period.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
        .select(
          "id, display_name, display_order, status, period_type, max_picks",
        )
        .eq("season_id", season.id)
        .order("display_order");

      if (periodsError || !periods?.length) {
        setErrorMessage("The weekly schedule could not be loaded.");
        setIsLoading(false);
        return;
      }

      const loadedWeeks = periods as ScoringPeriod[];
      setWeeks(loadedWeeks);

      const initialWeek =
        loadedWeeks.find((period) => period.status === "active") ??
        loadedWeeks.find((period) => period.status === "upcoming") ??
        loadedWeeks[0];

      await loadWeek(initialWeek, session.access_token);
    }

    void loadBoard();
  }, []);

  const availableWeeks = useMemo(() => {
    const currentWeek =
      weeks.find((period) => period.status === "active") ??
      weeks.find((period) => period.status === "upcoming");

    return weeks.filter(
      (period) =>
        period.status === "complete" || period.id === currentWeek?.id,
    );
  }, [weeks]);

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

  const selectionLimit =
    week?.period_type === "playoff" ? games.length : week?.max_picks ?? 2;

  const isReadOnly = week?.status === "complete";
  const hasEarlyGame = games.some(isEarlyGame);

  function isSelected(gameId: string, teamId: string) {
    return selectedPicks.some(
      (pick) => pick.gameId === gameId && pick.teamId === teamId,
    );
  }

  function chooseTeam(gameId: string, teamId: string) {
    if (isReadOnly) return;

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

    if (selectedPicks.length >= selectionLimit) {
      setSelectionWarning(
        `You already have ${selectionLimit} selections. Click one again to remove it first.`,
      );
      return;
    }

    setSelectedPicks((current) => [...current, { gameId, teamId }]);
  }

  async function chooseWeek(event: React.ChangeEvent<HTMLSelectElement>) {
    const selectedWeek = weeks.find(
      (period) => period.id === event.target.value,
    );

    if (!selectedWeek) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    await loadWeek(selectedWeek, session.access_token);
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

    setSubmissionMessage(data.message ?? "Your picks have been saved.");
  }

  if (isLoading && !week) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        Loading The Board…
      </main>
    );
  }

  if (errorMessage && !week) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        <p className="font-semibold text-red-700">{errorMessage}</p>
      </main>
    );
  }

  if (!week) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5f0e6] pb-56 text-[#171719]">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-10">
        <header className="border-b-2 border-[#1d1d1f] pb-6">
<div className="flex items-start justify-between gap-5">
  <div>
    <p className="text-sm font-bold tracking-[0.28em] text-slate-600">
      JOE BARR MEMORIAL
    </p>

    <h1 className="mt-2 font-serif text-4xl font-bold">
      The Board
    </h1>
  </div>

  <div className="max-w-xs text-right text-sm font-semibold text-slate-700">
    {hasEarlyGame ? (
      <>
        <p>EARLY GAME</p>
        <p className="mt-1 font-normal">
          Official spreads posted at 6 PM ET the night before.
        </p>
      </>
    ) : null}
  </div>
</div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label
                className="block text-xs font-bold tracking-[0.16em] text-slate-600"
                htmlFor="week-selector"
              >
                VIEW WEEK
              </label>

              <select
                className="mt-2 border border-[#1d1d1f] bg-white px-3 py-2 font-semibold"
                id="week-selector"
                onChange={chooseWeek}
                value={week.id}
              >
                {availableWeeks.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.display_name}
                    {period.status === "complete" ? " — Final" : ""}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-sm text-slate-700">
              {week.period_type === "playoff"
                ? "Choose every game."
                : "Choose 2 teams."}
            </p>
          </div>

<div className="mt-5 text-sm leading-6 text-slate-700">
<p>Official spreads posted at 8 AM on game day unless otherwise noted.</p>
<p>Favorites are on the left. Home teams are in ALL CAPS.</p>
<p>
  Click a team to select it. Click the Save button after making selections.
  Picks may be changed until official game time.
</p>
</div>
        </header>

        {isLoading ? (
          <p className="mt-8">Loading {week.display_name}…</p>
        ) : (
          <div className="mt-8 space-y-9">
            {gamesByDay.map(([day, dayGames]) => {

              return (
                <section key={day}>
                  <div className="flex flex-col gap-1 border-b border-slate-400 pb-2 sm:flex-row sm:items-end sm:justify-between">
                    <h2 className="font-bold tracking-[0.17em]">
                      {day.toUpperCase()}
                    </h2>


                  </div>

                  <div>
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

const gameHasStarted =
  new Date(game.kickoffAt) <= new Date();

return (
  <article                
                          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-400 py-4"
                          key={game.id}
                        >
                          <button
                            className={`text-left font-serif text-lg leading-tight md:text-xl ${
                              isSelected(game.id, leftTeamId)
                                ? "bg-[#1d1d1f] px-3 py-2 text-white"
                                : "hover:underline disabled:hover:no-underline"
                            }`}
                            disabled={isReadOnly || gameHasStarted}
                            onClick={() => chooseTeam(game.id, leftTeamId)}
                            type="button"
                          >
                            {teamLabel(leftTeamName, favoriteIsHome)}
                          </button>

<div className="min-w-24 text-center text-xs font-bold leading-5 text-slate-700 md:min-w-36">
  {game.officialSpread !== null ? (
    <p className="font-serif text-xl font-bold text-zinc-900">
      {officialSpreadLabel(game.officialSpread)}
    </p>
  ) : null}

  <p>{easternTime(game.kickoffAt)}</p>

  {isEarlyGame(game) ? (
    <p className="mt-1">
      EARLY GAME - SPREADS APPEAR{" "}
      {easternTime(game.lineLockAt)}
    </p>
  ) : null}
</div>

                          <button
                            className={`text-right font-serif text-lg leading-tight md:text-xl ${
                              isSelected(game.id, rightTeamId)
                                ? "bg-[#1d1d1f] px-3 py-2 text-white"
                                : "hover:underline disabled:hover:no-underline"
                            }`}
                            disabled={isReadOnly || gameHasStarted}
                            onClick={() => chooseTeam(game.id, rightTeamId)}
                            type="button"
                          >
                            {teamLabel(rightTeamName, !favoriteIsHome)}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {!isReadOnly ? (
        <aside className="fixed inset-x-0 bottom-0 border-t-2 border-[#1d1d1f] bg-[#f5f0e6] shadow-[0_-8px_24px_rgba(0,0,0,0.1)]">
          <div className="mx-auto max-w-5xl px-5 py-4 md:px-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="font-bold">
                  YOUR PICKS · {selectedPicks.length} OF {selectionLimit}
                </p>

                <ol className="mt-2 space-y-1 text-sm text-slate-700">
                  {selectedTeamNames.length ? (
                    selectedTeamNames.map((teamName, index) => (
                      <li key={`${teamName}-${index}`}>
                        {index + 1}. {teamName}
                      </li>
                    ))
                  ) : (
                    <li>Click a team above to make a selection.</li>
                  )}
                </ol>

                {selectionWarning ? (
                  <p className="mt-2 font-semibold text-red-700">
                    {selectionWarning}
                  </p>
                ) : null}

                {submissionMessage ? (
                  <div className="mt-2">
                    <p className="font-semibold text-green-800">
                      {submissionMessage}
                    </p>

                    {selectedPicks.length === 1 ? (
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        You still owe one pick this week.
                      </p>
                    ) : null}
                  </div>
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
                    : `Save ${selectedPicks.length} picks`}
              </button>
            </div>
          </div>
        </aside>
      ) : (
        <aside className="fixed inset-x-0 bottom-0 border-t-2 border-[#1d1d1f] bg-[#f5f0e6]">
          <div className="mx-auto max-w-5xl px-5 py-4 text-sm font-semibold md:px-10">
            This week is final and is shown for review only.
          </div>
        </aside>
      )}
    </main>
  );
}