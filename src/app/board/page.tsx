"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";

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
  preliminarySpread: number | null;
  spreadSource: string | null;
  spreadLockedAt: string | null;
  awayResult: "win" | "loss" | null;
  homeResult: "win" | "loss" | null;
};

type SelectedPick = {
  gameId: string;
  teamId: string;
};

type BoardResponse = {
  games: BoardGame[];
  myPicks: SelectedPick[];
  survivor: { status: "active" | "eliminated" | "complete"; pick: { game_id: string; selected_team_id: string } | null; usedTeamIds: string[] };
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

function resultMarker(result: "win" | "loss" | null) {
  if (!result) return null;

  return (
    <strong
      aria-label={`Against the spread: ${result}`}
      className={`absolute -right-1 -top-2 text-base font-black leading-none sm:text-lg ${
        result === "win" ? "text-green-700" : "text-red-700"
      }`}
    >
      {result === "win" ? "W" : "L"}
    </strong>
  );
}

export default function BoardPage() {
  const [weeks, setWeeks] = useState<ScoringPeriod[]>([]);
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([]);
  const [savedPicks, setSavedPicks] = useState<SelectedPick[]>([]);
  const [survivorPick, setSurvivorPick] = useState<SelectedPick | null>(null);
  const [savedSurvivorPick, setSavedSurvivorPick] = useState<SelectedPick | null>(null);
  const [survivorUsedTeamIds, setSurvivorUsedTeamIds] = useState<string[]>([]);
  const [survivorStatus, setSurvivorStatus] = useState<"active" | "eliminated" | "complete">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionWarning, setSelectionWarning] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const activeBoardRequest = useRef<AbortController | null>(null);
  const boardRequestId = useRef(0);

  async function loadWeek(period: ScoringPeriod, accessToken: string) {
    const requestId = boardRequestId.current + 1;
    boardRequestId.current = requestId;
    activeBoardRequest.current?.abort();

    const request = new AbortController();
    activeBoardRequest.current = request;
    const requestTimer = window.setTimeout(() => request.abort(), 15_000);

    setIsLoading(true);
    setErrorMessage("");
    setSelectionWarning("");
    setSubmissionMessage("");
    setWeek(period);

    try {
      const response = await fetch(`/api/board?scoringPeriodId=${period.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: request.signal,
      });

      const data = (await response.json()) as BoardResponse;

      if (requestId !== boardRequestId.current) return;

      if (!response.ok) {
        setErrorMessage(data.error ?? "The Slate could not be loaded.");
        return;
      }

      setGames(data.games);
      setSelectedPicks(data.myPicks);
      setSavedPicks(data.myPicks);
      setSurvivorPick(data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null);
      setSavedSurvivorPick(data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null);
      setSurvivorUsedTeamIds(data.survivor.usedTeamIds);
      setSurvivorStatus(data.survivor.status);
    } catch {
      if (requestId === boardRequestId.current) {
        setErrorMessage("The Slate is taking too long to load. Please try again.");
      }
    } finally {
      window.clearTimeout(requestTimer);
      if (requestId === boardRequestId.current) {
        activeBoardRequest.current = null;
        setIsLoading(false);
      }
    }
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

      const initialWeek = selectDefaultScoringPeriod(loadedWeeks);

      if (!initialWeek) {
        setErrorMessage("The weekly schedule could not be loaded.");
        setIsLoading(false);
        return;
      }

      await loadWeek(initialWeek, session.access_token);
    }

    void loadBoard();
  }, []);

  const availableWeeks = useMemo(() => {
    const currentWeek = selectDefaultScoringPeriod(weeks);

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

  const hasUnsavedChanges = useMemo(() => {
    const survivorChanged = survivorPick?.gameId !== savedSurvivorPick?.gameId || survivorPick?.teamId !== savedSurvivorPick?.teamId;
    if (survivorChanged) return true;
    if (selectedPicks.length !== savedPicks.length) return true;

    return selectedPicks.some(
      (pick) =>
        !savedPicks.some(
          (savedPick) =>
            savedPick.gameId === pick.gameId && savedPick.teamId === pick.teamId,
        ),
    );
  }, [savedPicks, savedSurvivorPick, selectedPicks, survivorPick]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);

    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const selectionLimit = week?.max_picks ?? 2;

  const isReadOnly = week?.status === "complete";
  const hasEarlyGame = games.some(isEarlyGame);
  const undoablePicks = selectedPicks.filter((pick) => {
    const game = games.find((item) => item.id === pick.gameId);
    return game && new Date(game.kickoffAt) > new Date();
  });

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
        [
          ...current.filter((pick) => pick.gameId !== gameId),
          { gameId, teamId },
        ],
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

  function clearLastSelection() {
    const lastSelection = undoablePicks.at(-1);

    if (!lastSelection) return;

    setSelectionWarning("");
    setSubmissionMessage("");
    setSelectedPicks((current) =>
      current.filter((pick) => pick.gameId !== lastSelection.gameId),
    );
  }

  async function chooseWeek(event: React.ChangeEvent<HTMLSelectElement>) {
    const selectedWeek = weeks.find(
      (period) => period.id === event.target.value,
    );

    if (!selectedWeek) return;

    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved pick changes. Switch weeks anyway?")
    ) {
      return;
    }

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

    if (!week) {
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
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), 15_000);

    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scoringPeriodId: week.id,
          selections: selectedPicks,
          survivorSelection: survivorPick,
        }),
        signal: request.signal,
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setSelectionWarning(
          data.error ?? "Your picks could not be saved. Please try again.",
        );
        return;
      }

      setSubmissionMessage(data.message ?? "Your picks have been saved.");
      setSavedPicks(selectedPicks);
      setSavedSurvivorPick(survivorPick);
    } catch {
      setSelectionWarning(
        "Your picks are taking too long to save. Please try again.",
      );
    } finally {
      window.clearTimeout(requestTimer);
      setIsSubmitting(false);
    }
  }

  if (isLoading && !week) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        Loading The Slate…
      </main>
    );
  }

  if (errorMessage && !week) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        <p className="font-semibold text-red-700">{errorMessage}</p>
        <button
          className="mt-5 bg-[#1d1d1f] px-5 py-3 font-bold text-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!week) {
    return null;
  }

  return (
    <main
      className={`min-h-screen bg-[#f5f0e6] text-[#171719] ${
        isReadOnly ? "pb-8" : "pb-48 sm:pb-56"
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8 md:px-10">
        <header className="border-b-2 border-[#1d1d1f] pb-4 sm:pb-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">
                The Slate
              </h1>
            </div>

            <aside className="max-w-[13rem] border-l border-slate-400 pl-3 text-right text-[11px] leading-4 text-slate-700 sm:max-w-xs sm:pl-4 sm:text-xs sm:leading-5">
              <p className="font-bold tracking-[0.12em] text-slate-800">
                HOW TO PLAY
              </p>
              <p className="mt-1">Favorites listed left; home team ALL CAPS.</p>
              <p>
                {week.period_type === "playoff"
                  ? "Select every team and hit Save below."
                  : "Select TWO teams and hit Save below."}
              </p>
              <p>Picks may be changed until listed kickoff.</p>
              {hasEarlyGame ? (
                <p className="mt-2 font-semibold">
                  EARLY GAME: spreads post at 6 PM ET the night before.
                </p>
              ) : null}
            </aside>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label
                className="block text-xs font-bold tracking-[0.16em] text-slate-600"
                htmlFor="week-selector"
              >
                VIEW WEEK
              </label>

              <select
                className="mt-1 border border-[#1d1d1f] bg-white px-3 py-1.5 text-sm font-semibold sm:mt-2 sm:py-2"
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

          </div>

          <p className="mt-4 text-xs leading-5 text-slate-700 sm:mt-5 sm:text-sm">
            Official spreads post at 8 AM ET on game day unless otherwise noted.
          </p>
        </header>

        {errorMessage ? (
          <div className="mt-8">
            <p className="font-semibold text-red-700">{errorMessage}</p>
            <button
              className="mt-4 bg-[#1d1d1f] px-5 py-3 font-bold text-white"
              onClick={() => window.location.reload()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <p className="mt-8">Loading {week.display_name}…</p>
        ) : (
          <div className="mt-5 space-y-6 sm:mt-8 sm:space-y-9">
            {survivorStatus === "active" && !isReadOnly ? (
              <section className="border-2 border-[#1d1d1f] bg-white p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div><p className="text-[10px] font-black tracking-[0.14em] text-slate-600">SURVIVOR</p><h2 className="font-serif text-xl font-bold">Choose one outright winner</h2></div>
                  <p className="text-right text-xs font-semibold text-slate-700">{survivorPick ? "Pick selected" : "No pick yet"}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {games.flatMap((game) => [
                    { gameId: game.id, teamId: game.awayTeamId, name: game.awayTeam },
                    { gameId: game.id, teamId: game.homeTeamId, name: game.homeTeam },
                  ]).map((team) => {
                    const selected = survivorPick?.teamId === team.teamId;
                    const used = survivorUsedTeamIds.includes(team.teamId) && !selected;
                    const gameHasStarted = new Date(games.find((game) => game.id === team.gameId)?.kickoffAt ?? 0) <= new Date();
                    return <button aria-pressed={selected} className={`min-h-11 border px-2 text-sm font-bold disabled:opacity-40 ${selected ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-slate-400 bg-[#f5f0e6]"}`} disabled={used || gameHasStarted} key={`${team.gameId}-${team.teamId}`} onClick={() => setSurvivorPick(selected ? null : { gameId: team.gameId, teamId: team.teamId })} type="button">◖ {team.name} {used ? "USED" : gameHasStarted ? "STARTED" : ""}</button>;
                  })}
                </div>
              </section>
            ) : null}
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

                      const leftTeamResult = favoriteIsHome
                        ? game.homeResult
                        : game.awayResult;

                      const rightTeamName = favoriteIsHome
                        ? game.awayTeam
                        : game.homeTeam;

                      const rightTeamId = favoriteIsHome
                        ? game.awayTeamId
                        : game.homeTeamId;

                      const rightTeamResult = favoriteIsHome
                        ? game.awayResult
                        : game.homeResult;

                      const gameHasStarted =
                        new Date(game.kickoffAt) <= new Date();

                      return (
                        <article
                          className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-400 py-2 sm:gap-3 sm:py-3"
                          key={game.id}
                        >
                          <button
                            className={`text-left font-serif text-base leading-tight sm:text-lg md:text-xl ${
                              isSelected(game.id, leftTeamId)
                                ? "bg-[#1d1d1f] px-2 py-1.5 text-white sm:px-3 sm:py-2"
                                : "hover:underline disabled:hover:no-underline"
                            }`}
                            disabled={isReadOnly || gameHasStarted}
                            onClick={() => chooseTeam(game.id, leftTeamId)}
                            type="button"
                          >
                            <span className="relative inline-block pr-4">
                              {teamLabel(leftTeamName, favoriteIsHome)}
                              {isReadOnly ? resultMarker(leftTeamResult) : null}
                            </span>
                          </button>

                          <div className="min-w-20 text-center text-[10px] font-bold leading-4 text-slate-700 sm:min-w-28 sm:text-xs md:min-w-36">
                            {game.officialSpread !== null ? (
                              <div className="flex items-baseline justify-center gap-1 whitespace-nowrap">
                                <span className="font-serif text-base font-bold text-zinc-900 sm:text-lg">
                                  {officialSpreadLabel(game.officialSpread)}
                                </span>
                                <span className="text-[8px] font-black tracking-[0.08em] text-green-800 sm:text-[9px]">
                                  FINAL
                                </span>
                              </div>
                            ) : game.preliminarySpread !== null ? (
                              <div className="flex items-baseline justify-center gap-1 whitespace-nowrap">
                                <span className="font-serif text-base font-bold text-amber-900 sm:text-lg">
                                  {officialSpreadLabel(game.preliminarySpread)}
                                </span>
                                <span className="text-[8px] font-black tracking-[0.08em] text-amber-800 sm:text-[9px]">
                                  PRELIM
                                </span>
                              </div>
                            ) : (
                              <p className="text-[8px] font-black tracking-[0.08em] text-slate-500 sm:text-[9px]">
                                LINE PENDING
                              </p>
                            )}

                            <p className="whitespace-nowrap">{easternTime(game.kickoffAt)}</p>

                            {isEarlyGame(game) && !isReadOnly ? (
                              <p className="mt-1">
                                EARLY GAME - SPREADS APPEAR{" "}
                                {easternTime(game.lineLockAt)}
                              </p>
                            ) : null}
                          </div>

                          <button
                            className={`text-right font-serif text-base leading-tight sm:text-lg md:text-xl ${
                              isSelected(game.id, rightTeamId)
                                ? "bg-[#1d1d1f] px-2 py-1.5 text-white sm:px-3 sm:py-2"
                                : "hover:underline disabled:hover:no-underline"
                            }`}
                            disabled={isReadOnly || gameHasStarted}
                            onClick={() => chooseTeam(game.id, rightTeamId)}
                            type="button"
                          >
                            <span className="relative inline-block pr-4">
                              {teamLabel(rightTeamName, !favoriteIsHome)}
                              {isReadOnly ? resultMarker(rightTeamResult) : null}
                            </span>
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
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-5 sm:py-4 md:px-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-[0.14em] text-slate-600">
                  YOUR PICKS · {selectedPicks.length} OF {selectionLimit}
                </p>

                <ol className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-700 sm:mt-2 sm:gap-2 sm:text-sm">
                  {selectedTeamNames.length ? (
                    selectedTeamNames.map((teamName, index) => (
                      <li className="border border-slate-400 bg-white px-2 py-1" key={`${teamName}-${index}`}>
                        {index + 1}. {teamName}
                      </li>
                    ))
                  ) : (
                    <li>Tap teams above to make your selections.</li>
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

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {undoablePicks.length > 0 ? (
                  <button
                    className="min-h-11 border-2 border-red-800 bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 sm:min-h-12 sm:px-6 sm:text-base"
                    onClick={clearLastSelection}
                    type="button"
                  >
                    Clear last selection
                  </button>
                ) : null}

                {hasUnsavedChanges ? (
                  <p className="text-xs font-bold text-amber-800 sm:text-sm">
                    Unsaved changes
                  </p>
                ) : null}

                <button
                  className="min-h-11 bg-[#1d1d1f] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-h-12 sm:px-6 sm:text-base"
                  disabled={isSubmitting}
                  onClick={submitPicks}
                  type="button"
                >
                {isSubmitting
                  ? "Saving…"
                  : selectedPicks.length === 0
                    ? "Save cleared picks"
                    : selectedPicks.length === 1
                      ? "Save 1 pick"
                      : `Save ${selectedPicks.length} picks`}
                </button>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
