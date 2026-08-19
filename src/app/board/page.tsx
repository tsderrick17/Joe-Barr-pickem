"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWithSession,
  getFreshSession,
  SessionUnavailableError,
} from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import {
  selectAvailableScoringPeriods,
  selectDefaultScoringPeriod,
} from "@/lib/scoring-period";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { nextWeekManualAccessAt } from "@/lib/week-rollover";
import {
  reconcileAtsDraftAtKickoff,
  reconcileSurvivorDraftAtKickoff,
} from "@/lib/slate-draft-locks";
import { isSurvivorSlateEditable } from "@/lib/survivor-availability";
import SlateGameRow from "@/components/slate-game-row";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

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
  isInternational: boolean;
  awayTeam: string;
  homeTeam: string;
  awayTeamAbbreviation: string;
  homeTeamAbbreviation: string;
  favoriteTeamId: string | null;
  awayTeamId: string;
  homeTeamId: string;
  officialSpread: number | null;
  preliminarySpread: number | null;
  spreadSource: string | null;
  spreadLockedAt: string | null;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  awayScore: number | null;
  homeScore: number | null;
  awayResult: "win" | "loss" | null;
  homeResult: "win" | "loss" | null;
  awayPickers: string[];
  homePickers: string[];
};

type SelectedPick = {
  gameId: string;
  teamId: string;
};

type BoardResponse = {
  serverTime: string;
  games: BoardGame[];
  myPicks: SelectedPick[];
  pickem: {
    playoffEliminated: boolean;
  };
  survivor: {
    available: boolean;
    chipsVisible: boolean;
    notice: string | null;
    status: "active" | "eliminated" | "complete";
    pick: { game_id: string; selected_team_id: string } | null;
    usedTeamIds: string[];
  };
  error?: string;
};

function SlateLoadingShell() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[#e9e2d3] text-[#171719]">
      <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 pb-0 pt-5 sm:px-5 sm:pt-8 md:px-10">
        <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10 md:py-3">
          <div className="slate-header-grid grid gap-5 md:gap-0">
            <div className="min-w-0 md:pr-7">
              <h1 className="whitespace-nowrap font-serif text-3xl font-bold sm:text-4xl">The Slate</h1>
              <p className="mt-4 text-xs font-bold tracking-[0.16em] text-slate-600">VIEW WEEK</p>
              <div className="mt-1 h-9 w-28 border border-[#1d1d1f] bg-white" />
            </div>
            <aside className="border-t border-[#b7aea0] pt-4 md:col-span-2 md:self-stretch md:border-l md:border-t-0 md:pt-0">
              <div className="h-[7.25rem] border-y-2 border-[#1d1d1f] bg-[#eee4d1]" />
              <div className="mt-2 h-16 border-t border-[#b7aea0] pt-3" />
            </aside>
          </div>
        </header>
        <div className="slate-loading-receipt h-[4.55rem] border-y border-[#b7aea0]" />
        <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 pb-10 sm:mt-8 sm:space-y-7">
          {Array.from({ length: 5 }, (_, index) => (
            <section key={index} className="space-y-2">
              <div className="mx-auto h-7 w-2/5 border-y-2 border-[#1d1d1f]" />
              {Array.from({ length: index === 2 ? 8 : 2 }, (_, rowIndex) => (
                <div key={rowIndex} className="h-14 border-y border-[#b7aea0] bg-[#f4ede1]" />
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function easternDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function easternCalendarDate(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/New_York",
    year: "numeric",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${read("year")}-${read("month")}-${read("day")}`;
}

function isEarlyGame(game: BoardGame) {
  return game.isInternational;
}

export default function BoardPage() {
  const [weeks, setWeeks] = useState<ScoringPeriod[]>([]);
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [nextWeekAvailableAt, setNextWeekAvailableAt] = useState<number | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [showActionOnly, setShowActionOnly] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [clockSynchronized, setClockSynchronized] = useState(false);
  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([]);
  const [savedPicks, setSavedPicks] = useState<SelectedPick[]>([]);
  const [survivorPick, setSurvivorPick] = useState<SelectedPick | null>(null);
  const [savedSurvivorPick, setSavedSurvivorPick] = useState<SelectedPick | null>(null);
  const [survivorUsedTeamIds, setSurvivorUsedTeamIds] = useState<string[]>([]);
  const [survivorAvailable, setSurvivorAvailable] = useState(true);
  const [survivorChipsVisible, setSurvivorChipsVisible] = useState(true);
  const [survivorStatus, setSurvivorStatus] = useState<"active" | "eliminated" | "complete">("active");
  const [playoffEliminated, setPlayoffEliminated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionWarning, setSelectionWarning] = useState("");
  const [selectionFeedback, setSelectionFeedback] = useState<{ gameId: string; teamId: string; type: "sweep"; token: number } | null>(null);
  const activeBoardRequest = useRef<AbortController | null>(null);
  const boardRequestId = useRef(0);
  const selectionFeedbackToken = useRef(0);
  const serverClockOffset = useRef(0);

  async function loadWeek(period: ScoringPeriod) {
    const requestId = boardRequestId.current + 1;
    boardRequestId.current = requestId;
    activeBoardRequest.current?.abort();

    const request = new AbortController();
    activeBoardRequest.current = request;
    const requestTimer = window.setTimeout(() => request.abort(), 15_000);

    setIsLoading(true);
    setErrorMessage("");
    setSelectionWarning("");
    setPlayoffEliminated(false);
    setClockSynchronized(false);
    setWeek(period);

    try {
      const response = await fetchWithSession(
        `/api/board?scoringPeriodId=${period.id}`,
        {
        signal: request.signal,
        },
      );

      const data = (await response.json()) as BoardResponse;

      if (requestId !== boardRequestId.current) return;

      if (!response.ok) {
        setErrorMessage(data.error ?? "The Slate could not be loaded.");
        return;
      }

      const serverTime = Date.parse(data.serverTime);
      if (!Number.isFinite(serverTime)) {
        setErrorMessage("The Slate clock could not be verified safely.");
        return;
      }

      serverClockOffset.current = serverTime - Date.now();
      setCurrentTime(serverTime);

      setGames(data.games);
      setPlayoffEliminated(data.pickem.playoffEliminated);
      setSelectedPicks(data.myPicks);
      setSavedPicks(data.myPicks);
      setSurvivorPick(data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null);
      setSavedSurvivorPick(data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null);
      setSurvivorUsedTeamIds(data.survivor.usedTeamIds);
      setSurvivorAvailable(data.survivor.available);
      setSurvivorChipsVisible(data.survivor.chipsVisible !== false);
      setSurvivorStatus(data.survivor.status);
      setClockSynchronized(true);
    } catch (error) {
      if (requestId === boardRequestId.current) {
        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return;
        }

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
    let disposed = false;

    async function retryInitialRead<T>(
      read: () => PromiseLike<T>,
      shouldRetry: (result: T) => boolean,
    ): Promise<T> {
      const firstResult = await read();
      if (!shouldRetry(firstResult)) return firstResult;

      // Schedule bootstrapping is read-only. One short retry protects the
      // first Slate render from a momentary database/network handoff without
      // replaying any player action.
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      return read();
    }

    async function loadBoard() {
      const session = await getFreshSession();

      if (disposed) return;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data: season, error: seasonError } = await retryInitialRead(
        () => supabase
          .from("seasons")
          .select("id")
          .eq("year", CURRENT_SEASON_YEAR)
          .maybeSingle(),
        (result) => Boolean(result.error || !result.data),
      );

      if (disposed) return;

      if (seasonError || !season) {
        setErrorMessage("The current season could not be loaded.");
        setIsLoading(false);
        return;
      }

      const { data: periods, error: periodsError } = await retryInitialRead(
        () => supabase
          .from("scoring_periods")
          .select(
            "id, display_name, display_order, status, period_type, max_picks",
          )
          .eq("season_id", season.id)
          .order("display_order"),
        (result) => Boolean(result.error || !result.data?.length),
      );

      if (disposed) return;

      if (periodsError || !periods?.length) {
        setErrorMessage("The weekly schedule could not be loaded.");
        setIsLoading(false);
        return;
      }

      const loadedWeeks = periods as ScoringPeriod[];
      setWeeks(loadedWeeks);

      const activePeriod = loadedWeeks.find((period) => period.status === "active");
      let manualAccessAt: number | null = null;

      if (activePeriod) {
        const { data: activeGames, error: activeGamesError } = await supabase
          .from("games")
          .select("kickoff_at, status, finalized_at")
          .eq("scoring_period_id", activePeriod.id);

        if (
          !activeGamesError &&
          activeGames?.length &&
          activeGames.every((game) =>
            ["final", "cancelled", "no_contest"].includes(game.status),
          )
        ) {
          const settlementTimes = activeGames.map((game) =>
            game.finalized_at ??
            (["cancelled", "no_contest"].includes(game.status)
              ? game.kickoff_at
              : null),
          );

          if (settlementTimes.every((value): value is string => Boolean(value))) {
            manualAccessAt = Date.parse(
              nextWeekManualAccessAt(settlementTimes.sort().at(-1)!),
            );
          }
        }
      }

      setNextWeekAvailableAt(manualAccessAt);

      const requestedWeekId = new URLSearchParams(window.location.search).get("week");
      const defaultWeek = selectDefaultScoringPeriod(loadedWeeks);
      const availableWeekIds = new Set(
        (selectAvailableScoringPeriods(loadedWeeks, {
          now: Date.now(),
          nextWeekAvailableAt: manualAccessAt,
        }) as ScoringPeriod[]).map((period) => period.id),
      );
      const requestedWeek = requestedWeekId
        ? loadedWeeks.find(
            (period) =>
              period.id === requestedWeekId && availableWeekIds.has(period.id),
          )
        : null;
      const initialWeek = requestedWeek ?? defaultWeek;

      if (!initialWeek) {
        setErrorMessage("The weekly schedule could not be loaded.");
        setIsLoading(false);
        return;
      }

      await loadWeek(initialWeek);
    }

    void loadBoard();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const refreshTime = window.setInterval(
      () => setCurrentTime(Date.now() + serverClockOffset.current),
      60_000,
    );
    return () => window.clearInterval(refreshTime);
  }, []);

  const availableWeeks = useMemo<ScoringPeriod[]>(() => {
    return selectAvailableScoringPeriods(weeks, {
      now: currentTime,
      nextWeekAvailableAt,
    }) as ScoringPeriod[];
  }, [currentTime, nextWeekAvailableAt, weeks]);

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

  const actionSwitchAvailable = useMemo(() => {
    if (!games.length) return false;
    const firstKickoff = games.reduce((earliest, game) =>
      new Date(game.kickoffAt).getTime() < new Date(earliest.kickoffAt).getTime() ? game : earliest,
    );

    return easternCalendarDate(currentTime) >= easternCalendarDate(firstKickoff.kickoffAt);
  }, [currentTime, games]);

  const actionOnlyActive = actionSwitchAvailable && showActionOnly;

  const visibleGamesByDay = useMemo(() => {
    if (!actionOnlyActive) return gamesByDay;

    return gamesByDay
      .map(([day, dayGames]) => [
        day,
        dayGames.filter((game) => {
        const stillOpenForSelection = new Date(game.kickoffAt).getTime() > currentTime;
          const hasPublishedPoolAction = game.awayPickers.length > 0 || game.homePickers.length > 0;
          return stillOpenForSelection || hasPublishedPoolAction;
        }),
      ] as const)
      .filter(([, dayGames]) => dayGames.length > 0);
}, [actionOnlyActive, currentTime, gamesByDay]);

  const selectedTeams = useMemo(() => {
    const gameOrder = new Map(games.map((game, index) => [game.id, index]));

    return [...selectedPicks]
      .sort((left, right) => (gameOrder.get(left.gameId) ?? Number.MAX_SAFE_INTEGER) - (gameOrder.get(right.gameId) ?? Number.MAX_SAFE_INTEGER))
      .map((pick) => {
        const game = games.find((item) => item.id === pick.gameId);

        if (!game) return null;
        const isHome = pick.teamId === game.homeTeamId;
        const isAway = pick.teamId === game.awayTeamId;
        const name = isHome
          ? game.homeTeam.toUpperCase()
          : isAway
            ? game.awayTeam
            : null;

        if (!name) return null;

        const canonicalAbbreviation = (isHome ? game.homeTeamAbbreviation : game.awayTeamAbbreviation).toUpperCase();
        // Keep the compact receipt convention everywhere: home abbreviations
        // are uppercase while away abbreviations remain lowercase.
        const abbreviation = isHome ? canonicalAbbreviation : canonicalAbbreviation.toLowerCase();
        const hasFinalLine = game.spreadLockedAt !== null && game.officialSpread !== null;
        const selectedTeamIsFavorite = pick.teamId === game.favoriteTeamId;
        const displayedSpread = hasFinalLine ? game.officialSpread : game.preliminarySpread;
        const lineValue = displayedSpread === null
          ? null
          : displayedSpread === 0
            ? "PK"
            : `${selectedTeamIsFavorite ? "-" : "+"}${Number.isInteger(displayedSpread) ? displayedSpread : displayedSpread.toFixed(1)}`;

        const isSaved = savedPicks.some(
          (savedPick) => savedPick.gameId === pick.gameId && savedPick.teamId === pick.teamId,
        );

        return {
          gameId: pick.gameId,
          name,
          abbreviation,
          lineValue,
          isLineLocked: hasFinalLine,
          canRemove: new Date(game.kickoffAt).getTime() > currentTime,
          isSaved,
        };
      })
      .filter(Boolean) as { gameId: string; name: string; abbreviation: string; lineValue: string | null; isLineLocked: boolean; canRemove: boolean; isSaved: boolean }[];
  }, [currentTime, games, savedPicks, selectedPicks]);

  const pickemHasUnsavedChanges = useMemo(() => {
    if (selectedPicks.length !== savedPicks.length) return true;
    return selectedPicks.some(
      (pick) =>
        !savedPicks.some(
          (savedPick) =>
            savedPick.gameId === pick.gameId && savedPick.teamId === pick.teamId,
        ),
    );
  }, [savedPicks, selectedPicks]);

  const survivorHasUnsavedChanges = survivorAvailable &&
    (survivorPick?.gameId !== savedSurvivorPick?.gameId || survivorPick?.teamId !== savedSurvivorPick?.teamId);
  const hasUnsavedChanges = pickemHasUnsavedChanges || survivorHasUnsavedChanges;

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

  const isReadOnly = week?.status === "complete" || playoffEliminated;
  const survivorSelectedGame = survivorPick
    ? games.find((game) => game.id === survivorPick.gameId) ?? null
    : null;
  const savedSurvivorGame = savedSurvivorPick
    ? games.find((game) => game.id === savedSurvivorPick.gameId) ?? null
    : null;
  const survivorLockGame = savedSurvivorGame ?? survivorSelectedGame;
  const survivorControlsEnabled = isSurvivorSlateEditable({
    periodType: week?.period_type,
    periodStatus: week?.status,
    survivorAvailable,
    survivorStatus,
    selectedGameKickoffAt: survivorLockGame?.kickoffAt ?? null,
    now: new Date(currentTime),
  });
  const showSurvivorReceipt = week?.period_type === "regular" &&
    survivorAvailable && survivorStatus === "active";
  const survivorTeamName = (pick: SelectedPick | null) => {
    if (!pick) return "";
    const game = games.find((item) => item.id === pick.gameId);
    return pick.teamId === game?.awayTeamId ? game.awayTeam : pick.teamId === game?.homeTeamId ? game.homeTeam : "";
  };
  const survivorReceipt = survivorTeamName(survivorPick) || (survivorStatus === "complete" ? "COMPLETE" : survivorStatus === "eliminated" ? "OUT" : "OPEN");
  // Saved selections arrive asynchronously. Keep the receipt neutral until
  // they do so, rather than briefly presenting an incorrect OPEN ticket.
  const receiptIsLoading = isLoading;
  // The receipt stays calm once it matches the saved record. Its sheen and
  // tactile click are reserved for a new selection or a change to a saved one.
  const receiptNeedsSaving = !receiptIsLoading && hasUnsavedChanges;
  const pickemReceiptStatus = receiptIsLoading
    ? "CHECKING"
    : pickemHasUnsavedChanges
      ? "CHANGED"
      : selectedPicks.length === selectionLimit
        ? "FILLED"
        : "OPEN";
  const survivorReceiptStatus = receiptIsLoading
    ? "CHECKING"
    : survivorHasUnsavedChanges
      ? "CHANGED"
      : survivorReceipt === "OPEN"
        ? "OPEN"
        : survivorReceipt === "OUT" || survivorReceipt === "COMPLETE"
          ? survivorReceipt
          : "FILLED";
  const receiptStatusLabel = (status: string) => {
    if (status === "FILLED") return "SUBMITTED";
    if (status === "CHANGED") return "CHANGED - HIT SUBMIT";
    return status;
  };
  const sealedPickCount = selectedTeams.filter((team) => !team.canRemove).length;
  const openPickCount = selectedTeams.length - sealedPickCount;
  const duePickCount = Math.max(selectionLimit - selectedTeams.length, 0);
  const pickemReceiptStateDetail = [
    sealedPickCount > 0 ? `${sealedPickCount} SEALED` : "",
    openPickCount > 0 && sealedPickCount > 0 ? `${openPickCount} EDITABLE` : "",
    duePickCount > 0 ? `${duePickCount} DUE` : "",
  ].filter(Boolean).join(" · ");
  const survivorPickDetails = (() => {
    if (!survivorPick) return null;
    const game = games.find((item) => item.id === survivorPick.gameId);
    if (!game) return null;
    const isAway = survivorPick.teamId === game.awayTeamId;
    const isHome = survivorPick.teamId === game.homeTeamId;
    if (!isAway && !isHome) return null;
    return {
      name: isAway ? game.awayTeam : game.homeTeam,
      abbreviation: isAway ? game.awayTeamAbbreviation : game.homeTeamAbbreviation,
    };
  })();
  const hasEarlyGame = games.some(isEarlyGame);

  useEffect(() => {
    if (isLoading || !clockSynchronized || games.length === 0) return;

    const now = new Date(currentTime);
    const atsDraft = reconcileAtsDraftAtKickoff({
      games,
      selections: selectedPicks,
      savedPicks,
      now,
    });
    const survivorDraft = reconcileSurvivorDraftAtKickoff({
      games,
      selection: survivorPick,
      savedPick: savedSurvivorPick,
      now,
    });

    if (!atsDraft.changed && !survivorDraft.changed) return;

    const reconcileTimer = window.setTimeout(() => {
      if (atsDraft.changed) setSelectedPicks(atsDraft.selections);
      if (survivorDraft.changed) setSurvivorPick(survivorDraft.selection);
      if (atsDraft.discardedAtKickoff || survivorDraft.discardedAtKickoff) {
        setSelectionWarning(
          "Kickoff passed. Unsaved changes for that game were discarded; submitted picks remain sealed.",
        );
      }
    }, 0);

    return () => window.clearTimeout(reconcileTimer);
  }, [clockSynchronized, currentTime, games, isLoading, savedPicks, savedSurvivorPick, selectedPicks, survivorPick]);

  function showSelectionFeedback(gameId: string, teamId: string, type: "sweep") {
    selectionFeedbackToken.current += 1;
    setSelectionFeedback({ gameId, teamId, type, token: selectionFeedbackToken.current });
  }

  function chooseTeam(gameId: string, teamId: string) {
    if (isReadOnly) return;

    setSelectionWarning("");

    const game = games.find((item) => item.id === gameId);
    if (!game || new Date(game.kickoffAt).getTime() <= currentTime) {
      setSelectionWarning("That game has kicked off. Its submitted pick is sealed.");
      return;
    }

    const existingPick = selectedPicks.find((pick) => pick.gameId === gameId);

    if (existingPick?.teamId === teamId) {
      setSelectedPicks((current) => current.filter((pick) => pick.gameId !== gameId));
      setSelectionFeedback(null);
      return;
    }

    if (existingPick) {
      setSelectedPicks((current) =>
        [
          ...current.filter((pick) => pick.gameId !== gameId),
          { gameId, teamId },
        ],
      );
      showSelectionFeedback(gameId, teamId, "sweep");
      return;
    }

    if (selectedPicks.length >= selectionLimit) {
      setSelectionWarning(
        `You already have ${selectionLimit} selections. Click one again to remove it first.`,
      );
      return;
    }

    setSelectedPicks((current) => [...current, { gameId, teamId }]);
    showSelectionFeedback(gameId, teamId, "sweep");
  }

  function chooseSurvivorTeam(gameId: string, teamId: string) {
    if (!survivorControlsEnabled) return;

    const game = games.find((item) => item.id === gameId);
    if (!game || new Date(game.kickoffAt).getTime() <= currentTime) return;

    const isCurrentSelection = survivorPick?.teamId === teamId;
    // During an unsaved replacement, the originally saved team must remain
    // selectable too. The client can still hold an older used-team snapshot
    // until the next board refresh, so explicitly preserve the active week's
    // saved team here as well as on the server.
    const isThisWeeksSavedPick = savedSurvivorPick?.teamId === teamId;
    if (
      survivorUsedTeamIds.includes(teamId) &&
      !isCurrentSelection &&
      !isThisWeeksSavedPick
    ) {
      setSelectionWarning("That team has already been used in Survivor.");
      return;
    }

    setSelectionWarning("");
    setSurvivorPick({ gameId, teamId });
  }

  function removeSelection(gameId: string) {
    setSelectionWarning("");
    const game = games.find((item) => item.id === gameId);
    if (!game || new Date(game.kickoffAt).getTime() <= currentTime) {
      setSelectionWarning("That game has kicked off. Its submitted pick is sealed.");
      return;
    }
    setSelectedPicks((current) =>
      current.filter((pick) => pick.gameId !== gameId),
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

    setShowActionOnly(false);
    await loadWeek(selectedWeek);
  }

  async function submitPicks() {
    setSelectionWarning("");

    if (!week) {
      return;
    }

    setIsSubmitting(true);
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), 15_000);

    try {
      const response = await fetchWithSession("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoringPeriodId: week.id,
          selections: selectedPicks,
          ...(survivorAvailable
            ? { survivorSelection: survivorPick }
            : {}),
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

      setSavedPicks(selectedPicks);
      if (survivorAvailable) {
        setSavedSurvivorPick(survivorPick);
      }
    } catch (error) {
      if (error instanceof SessionUnavailableError) {
        window.location.replace("/login");
        return;
      }

      setSelectionWarning(
        "Your picks are taking too long to save. Please try again.",
      );
    } finally {
      window.clearTimeout(requestTimer);
      setIsSubmitting(false);
    }
  }

  if (isLoading && !week) return <SlateLoadingShell />;

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
    <main className="min-h-screen bg-[#e9e2d3] text-[#171719]">
      <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 pb-0 pt-5 sm:px-5 sm:pb-0 sm:pt-8 md:px-10">
        <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10 md:py-3">
          <div className="slate-header-grid grid gap-5 md:gap-0">
            <div className="min-w-0 md:pr-7">
              <h1 className="whitespace-nowrap font-serif text-3xl font-bold sm:text-4xl">
                The Slate
              </h1>
              <label
                className="mt-4 block text-xs font-bold tracking-[0.16em] text-slate-600"
                htmlFor="week-selector"
              >
                VIEW WEEK
              </label>

              <select
                className="mt-1 border border-[#1d1d1f] bg-white px-3 py-1.5 text-sm font-semibold text-[#171719]"
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

              {actionSwitchAvailable ? (
                <div className="slate-view-switch-slot">
                  <div className={`slate-view-switch slate-view-switch--header ${actionOnlyActive ? "is-action-only" : ""}`} aria-label="Slate display" role="group">
                    <span className={!actionOnlyActive ? "is-active" : ""}>ALL GAMES</span>
                    <button aria-checked={actionOnlyActive} aria-label={actionOnlyActive ? "Show all games" : "Show pool action"} onClick={() => setShowActionOnly((current) => !current)} role="switch" type="button"><span /></button>
                    <span className={actionOnlyActive ? "is-active" : ""}>POOL ACTION</span>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="border-t border-[#b7aea0] pt-4 text-left text-xs leading-5 text-slate-700 md:col-span-2 md:self-stretch md:border-l md:border-t-0 md:pt-0">
              <div className={`slate-action-instructions ${survivorControlsEnabled ? "has-survivor" : ""} mt-0 grid gap-2 border-y-2 border-[#1d1d1f] bg-[#eee4d1] px-3 py-2.5 text-[11px] leading-4 text-[#17354d] sm:text-xs ${survivorControlsEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">PICK&apos;EM</strong>Click a team name to make your against-the-spread pick{week?.period_type === "playoff" ? " for every playoff game" : "s"}.</p>
                {survivorControlsEnabled ? <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">SURVIVOR</strong>Click a poker chip to choose one outright winner.</p> : null}
                <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">SUBMIT</strong>Review your choices, then click <span className="font-black">SUBMIT</span> to save the picks currently shown.</p>
              </div>
              <div className="slate-how-to-grid mt-2 grid gap-3 border-t border-[#b7aea0] pt-3 sm:gap-0">
                <div className="md:pl-4">
                  <p>Lines lock at 8 AM ET on gameday, unless otherwise noted.</p>
                  <p className="mt-1"><span className="font-semibold text-[#00756e]">Teal lines</span> are official and will not change.</p>
                </div>
                <div className="border-t border-[#b7aea0] pt-3 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
                  <p>Favorites left; home team ALL CAPS.</p>
                  <p className="mt-1">Changes allowed until kickoff time.</p>
                </div>
                <p className="slate-winner-rule sm:col-span-2">Only winners count: Pick&apos;em pushes and Survivor ties are losses.</p>
              </div>
              {hasEarlyGame ? (
                <p className="mt-3 border-t border-[#b7aea0] pt-3 font-semibold md:pl-4">
                  EARLY GAME: spreads post at 6 PM ET the night before.
                </p>
              ) : null}
            </aside>
          </div>

        </header>

        <section
          aria-label="Your weekly receipt"
          className={`slate-mini-nav slate-receipt-strip ${showSurvivorReceipt ? "has-survivor" : "is-pickem-only"} ${week?.period_type === "playoff" ? "is-playoff" : ""} ${sealedPickCount > 0 && openPickCount > 0 ? "has-mixed-locks" : ""} ${receiptIsLoading ? "receipt-is-loading" : ""}`}
        >
          <div className="slate-receipt-ticket">
            <span>YOUR RECEIPT</span>
            <Link href="/#my-ticket">VIEW FULL TICKET</Link>
            <button
              className={`slate-receipt-print ${receiptNeedsSaving ? "needs-attention" : ""}`}
              disabled={receiptIsLoading || isSubmitting}
              onClick={submitPicks}
              type="button"
            >
              SUBMIT
            </button>
          </div>
          <div className="slate-receipt-pool slate-receipt-pickem">
            <span>PICK&apos;EM</span>
            <div className={`slate-receipt-selection-chips slate-receipt-selection-chips--${week?.period_type === "playoff" ? "playoff" : "regular"} slate-receipt-selection-chips--slots-${Math.min(selectionLimit, 6)}`} style={{ "--selection-slot-count": Math.min(selectionLimit, 6) } as CSSProperties}>
              {receiptIsLoading ? <strong className="is-quiet">CHECKING</strong> : selectedTeams.length ? selectedTeams.map((team, index) => (
                <span
                  className={`selection-chip slate-receipt-selection-chip ${team.isSaved ? "is-saved" : "is-draft"} ${team.canRemove ? "is-editable" : "is-sealed"}`}
                  key={team.gameId}
                  title={team.abbreviation}
                >
                  <span>{index + 1}. {team.abbreviation}{team.lineValue ? <small className={team.isLineLocked ? "is-official" : ""}> {team.lineValue}</small> : null}</span>
                  {team.canRemove ? <button aria-label={`Remove ${team.name}`} onClick={() => removeSelection(team.gameId)} type="button">×</button> : <span aria-label="Sealed at kickoff" className="slate-receipt-lock-mark" role="img">🔒</span>}
                </span>
              )) : <strong className="is-due">PICK DUE</strong>}
            </div>
            <em className={pickemReceiptStatus === "CHANGED" ? "is-unsaved" : pickemReceiptStatus === "FILLED" ? "is-complete" : ""}>{receiptIsLoading ? "CHECKING" : <>{selectedPicks.length}/{selectionLimit} · {receiptStatusLabel(pickemReceiptStatus)}{pickemReceiptStateDetail ? <small> · {pickemReceiptStateDetail}</small> : null}</>}</em>
          </div>
          {showSurvivorReceipt ? (
            <div className="slate-receipt-pool slate-receipt-survivor">
              <span>SURVIVOR</span>
              <div className={`slate-receipt-survivor-pick ${survivorHasUnsavedChanges && survivorControlsEnabled ? "is-awaiting-lock" : ""}`}>
                {!receiptIsLoading && survivorPickDetails ? <><SurvivorPokerChip abbreviation={survivorPickDetails.abbreviation} size="summary" teamName={survivorPickDetails.name} tooltip={survivorPickDetails.abbreviation} /><strong aria-label={survivorPickDetails.name}><span className="receipt-team-name-full">{survivorPickDetails.name}</span><span className="receipt-team-name-short" aria-hidden="true">{survivorPickDetails.abbreviation}</span></strong></> : <strong className={survivorReceiptStatus === "OPEN" ? "is-due" : survivorReceiptStatus === "OUT" ? "is-out" : "is-quiet"}>{receiptIsLoading ? "CHECKING" : survivorReceipt}</strong>}
              </div>
              <em className={survivorReceiptStatus === "CHANGED" ? "is-unsaved" : survivorReceiptStatus === "FILLED" ? "is-complete" : ""}>{receiptIsLoading ? "CHECKING" : receiptStatusLabel(survivorReceiptStatus)}</em>
            </div>
          ) : null}
          {selectionWarning ? <p className="slate-receipt-warning" role="alert">{selectionWarning}</p> : null}
        </section>

        {playoffEliminated ? (
          <section className="mt-5 border-l-4 border-red-800 bg-red-50 px-4 py-3 text-red-950">
            <p className="font-bold">Playoff race: mathematically eliminated</p>
            <p className="mt-1 text-sm">Your existing selections remain on the Slate for the season&apos;s audit trail. You are not eligible to make further Pick&apos;em selections.</p>
          </section>
        ) : null}

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
          <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 sm:mt-8 sm:space-y-7" id="slate-matchups">
            {actionOnlyActive && visibleGamesByDay.length === 0 ? (
              <p className="slate-action-empty">Every game still open for selection appears here. Locked games join this view as pool picks become public at kickoff.</p>
            ) : null}
            {visibleGamesByDay.map(([day, dayGames]) => {
              return (
                <section key={day}>
                  <div className="border-y-2 border-[#1d1d1f] px-2 py-1.5 text-center sm:px-3 sm:py-2">
                    <h2 className="text-xs font-black tracking-[0.18em] text-[#171719] sm:text-sm">
                      {day.toUpperCase()}
                    </h2>
                  </div>

                  <div>
                    {dayGames.map((game, index) => (
                      <SlateGameRow
                        allowSelection={!isReadOnly}
                        alternate={index % 2 === 0}
                        game={game}
                        hasStarted={new Date(game.kickoffAt).getTime() <= currentTime}
                        key={game.id}
                        onChoose={chooseTeam}
                        selectedTeamId={selectedPicks.find((pick) => pick.gameId === game.id)?.teamId}
                        selectionFeedback={selectionFeedback?.gameId === game.id ? selectionFeedback : null}
                        survivor={survivorChipsVisible && survivorStatus !== "eliminated" ? {
                          enabled: true,
                          interactive: survivorControlsEnabled,
                          selectedTeamId: survivorPick?.teamId ?? null,
                          savedTeamId: savedSurvivorPick?.teamId ?? null,
                          usedTeamIds: survivorUsedTeamIds,
                          onChoose: chooseSurvivorTeam,
                        } : undefined}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

    </main>
  );
}
