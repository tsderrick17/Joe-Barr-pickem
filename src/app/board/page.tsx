"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWithSession,
  SessionUnavailableError,
} from "@/lib/auth-session";
import {
  selectAvailableScoringPeriods,
  selectDefaultScoringPeriod,
} from "@/lib/scoring-period";
import {
  reconcileAtsDraftAtKickoff,
  reconcileSurvivorDraftAtKickoff,
} from "@/lib/slate-draft-locks";
import { buildSlateSubmission } from "@/lib/slate-submission";
import { isSurvivorSlateEditable } from "@/lib/survivor-availability";
import SlateGameRow from "@/components/slate-game-row";
import { useStableCallback } from "@/lib/use-stable-callback";
import { decidePickChoice, decideRemoval, decideSurvivorChoice, describeSelectedTeams, filterPoolActionDays, groupGamesByDay, picksDiffer, withPick, withoutGame } from "@/lib/slate-view";
import SlateHeader from "@/components/slate-header";
import SlateReceipt from "@/components/slate-receipt";
import type { PickSaveRequest, PickSaveResponse, ProfileUpdateRequest, SlateGame as BoardGame, SlateResponse as BoardResponse, SlateScoringPeriod as ScoringPeriod } from "@/lib/api-contracts";

type SelectedPick = {
  gameId: string;
  teamId: string;
};

// A pick save can briefly wait behind database work that is already in
// progress. Keep the request alive long enough for that safe, serialized save
// to return rather than telling a player it failed while the server finishes.
const PICK_SAVE_TIMEOUT_MS = 30_000;

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
        <div className="slate-loading-receipt h-[6.75rem] border-y border-[#b7aea0] md:h-[5.8rem]" />
        <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 pb-10 md:mt-8 md:space-y-7">
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
  const [survivorOnReceipt, setSurvivorOnReceipt] = useState(true);
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
  const kickoffVisibilityRefreshedGameIds = useRef(new Set<string>());

  // One place that puts a board response into the page's state, used by the
  // first load and by every week change. It also applies the player's durable
  // display choice (All Games or Pool Action), which the bootstrap once forgot.
  function applyBoard(data: BoardResponse) {
    const pick = data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null;
    setGames(data.games);
    setShowActionOnly(Boolean(data.showPoolAction));
    setPlayoffEliminated(data.pickem.playoffEliminated);
    setSelectedPicks(data.myPicks);
    setSavedPicks(data.myPicks);
    setSurvivorPick(pick);
    setSavedSurvivorPick(pick);
    setSurvivorUsedTeamIds(data.survivor.usedTeamIds);
    setSurvivorAvailable(data.survivor.available);
    setSurvivorChipsVisible(data.survivor.chipsVisible !== false);
    setSurvivorOnReceipt(data.survivor.showOnReceipt !== false);
    setSurvivorStatus(data.survivor.status);
  }

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
    kickoffVisibilityRefreshedGameIds.current.clear();
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
      kickoffVisibilityRefreshedGameIds.current = new Set(
        data.games
          .filter((game) => Date.parse(game.kickoffAt) <= serverTime)
          .map((game) => game.id),
      );

      applyBoard(data);
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

    async function loadBoard() {
      const requestedWeekId = new URLSearchParams(window.location.search).get("week");
      const params = new URLSearchParams({ bootstrap: "1" });
      if (requestedWeekId) params.set("week", requestedWeekId);

      try {
        const response = await fetchWithSession(`/api/board?${params}`);
        const data = (await response.json()) as BoardResponse;

        if (disposed) return;
        if (!response.ok || !data.bootstrap) {
          setErrorMessage(data.error ?? "The Slate could not be loaded.");
          return;
        }

        const loadedWeeks = data.bootstrap.weeks;
        const manualAccessAt = data.bootstrap.nextWeekAvailableAt
          ? Date.parse(data.bootstrap.nextWeekAvailableAt)
          : null;
        const availableWeeks = selectAvailableScoringPeriods(loadedWeeks, {
          now: Date.parse(data.serverTime),
          nextWeekAvailableAt: manualAccessAt,
        }) as ScoringPeriod[];
        const initialWeek = requestedWeekId
          ? availableWeeks.find((period) => period.id === requestedWeekId) ??
            selectDefaultScoringPeriod(loadedWeeks)
          : selectDefaultScoringPeriod(loadedWeeks);

        if (!initialWeek) {
          setErrorMessage("The weekly schedule could not be loaded.");
          return;
        }

        serverClockOffset.current = Date.parse(data.serverTime) - Date.now();
        setCurrentTime(Date.parse(data.serverTime));
        kickoffVisibilityRefreshedGameIds.current = new Set(
          data.games
            .filter((game) => Date.parse(game.kickoffAt) <= Date.parse(data.serverTime))
            .map((game) => game.id),
        );
        setWeeks(loadedWeeks);
        setNextWeekAvailableAt(manualAccessAt);
        setWeek(initialWeek);
        applyBoard(data);
        setClockSynchronized(true);
      } catch (error) {
        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return;
        }
        setErrorMessage("The Slate is taking too long to load. Please try again.");
      } finally {
        if (!disposed) setIsLoading(false);
      }
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

  useEffect(() => {
    if (!week || isLoading || !clockSynchronized || games.length === 0) return;

    const requestId = boardRequestId.current;
    const dueGameIds = games
      .filter((game) => new Date(game.kickoffAt).getTime() <= currentTime && !kickoffVisibilityRefreshedGameIds.current.has(game.id))
      .map((game) => game.id);

    const refreshPublicVisibility = async (gameIds: string[]) => {
      gameIds.forEach((gameId) => kickoffVisibilityRefreshedGameIds.current.add(gameId));

      try {
        const response = await fetchWithSession(`/api/board?scoringPeriodId=${week.id}`);
        const data = (await response.json()) as BoardResponse;
        if (requestId !== boardRequestId.current) return;
        if (!response.ok) {
          gameIds.forEach((gameId) => kickoffVisibilityRefreshedGameIds.current.delete(gameId));
          return;
        }

        const serverTime = Date.parse(data.serverTime);
        if (!Number.isFinite(serverTime)) {
          gameIds.forEach((gameId) => kickoffVisibilityRefreshedGameIds.current.delete(gameId));
          return;
        }

        serverClockOffset.current = serverTime - Date.now();
        setCurrentTime(serverTime);
        setGames(data.games);
        setPlayoffEliminated(data.pickem.playoffEliminated);
      } catch {
        // The next minute tick retries a harmless read. Keep player drafts in
        // memory rather than resetting the entire Slate after a brief outage.
        gameIds.forEach((gameId) => kickoffVisibilityRefreshedGameIds.current.delete(gameId));
      }
    };

    if (dueGameIds.length) {
      void refreshPublicVisibility(dueGameIds);
      return;
    }

    const nextKickoff = games
      .map((game) => new Date(game.kickoffAt).getTime())
      .filter((kickoffAt) => kickoffAt > currentTime)
      .sort((left, right) => left - right)[0];
    if (!nextKickoff) return;

    // A small cushion lets the kickoff boundary settle server-side before the
    // public receipt is read. The same server clock governs both behaviors.
    const timer = window.setTimeout(
      () => void refreshPublicVisibility(games.filter((game) => new Date(game.kickoffAt).getTime() === nextKickoff).map((game) => game.id)),
      Math.max(nextKickoff - currentTime, 0) + 500,
    );
    return () => window.clearTimeout(timer);
  }, [clockSynchronized, currentTime, games, isLoading, week]);

  const availableWeeks = useMemo<ScoringPeriod[]>(() => {
    return selectAvailableScoringPeriods(weeks, {
      now: currentTime,
      nextWeekAvailableAt,
    }) as ScoringPeriod[];
  }, [currentTime, nextWeekAvailableAt, weeks]);

  const gamesByDay = useMemo(() => groupGamesByDay(games), [games]);

  const actionOnlyActive = showActionOnly;

  const visibleGamesByDay = useMemo(() => {
    if (!actionOnlyActive) return gamesByDay;
    return filterPoolActionDays(gamesByDay, currentTime);
  }, [actionOnlyActive, currentTime, gamesByDay]);

  const selectedTeams = useMemo(
    () => describeSelectedTeams({ picks: selectedPicks, savedPicks, games, now: currentTime }),
    [currentTime, games, savedPicks, selectedPicks],
  );

  const pickemHasUnsavedChanges = useMemo(() => picksDiffer(selectedPicks, savedPicks), [savedPicks, selectedPicks]);

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
  // The Survivor section leaves the receipt the week after a player is out (or
  // after a champion is crowned) and returns with the next season.
  const showSurvivorReceipt = week?.period_type === "regular" &&
    survivorAvailable && survivorOnReceipt;
  const survivorTeamName = (pick: SelectedPick | null) => {
    if (!pick) return "";
    const game = games.find((item) => item.id === pick.gameId);
    return pick.teamId === game?.awayTeamId ? game.awayTeam : pick.teamId === game?.homeTeamId ? game.homeTeam : "";
  };
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

    const choice = decidePickChoice({ picks: selectedPicks, games, gameId, teamId, now: currentTime, limit: selectionLimit });
    switch (choice.kind) {
      case "sealed":
      case "limit":
        setSelectionWarning(choice.warning);
        return;
      case "remove":
        setSelectedPicks((current) => withoutGame(current, gameId));
        setSelectionFeedback(null);
        return;
      case "swap":
      case "add":
        setSelectedPicks((current) => withPick(current, gameId, teamId));
        showSelectionFeedback(gameId, teamId, "sweep");
        return;
    }
  }

  function chooseSurvivorTeam(gameId: string, teamId: string) {
    if (!survivorControlsEnabled) return;

    const choice = decideSurvivorChoice({ games, gameId, teamId, now: currentTime, current: survivorPick, saved: savedSurvivorPick, usedTeamIds: survivorUsedTeamIds });
    if (choice.kind === "ignore") return;
    if (choice.kind === "warn") {
      setSelectionWarning(choice.warning);
      return;
    }

    setSelectionWarning("");
    setSurvivorPick({ gameId, teamId });
  }

  function removeSelection(gameId: string) {
    setSelectionWarning("");
    const removal = decideRemoval({ games, gameId, now: currentTime });
    if (!removal.allowed) {
      setSelectionWarning(removal.warning);
      return;
    }
    setSelectedPicks((current) => withoutGame(current, gameId));
  }

  // Flip between All Games and Pool Action, and remember the choice.
  const toggleDisplay = useStableCallback(() => {
    const next = !showActionOnly;
    setShowActionOnly(next);
    const update: ProfileUpdateRequest = { showPoolAction: next };
    void fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) }).then(async (response) => {
      if (!response.ok) throw new Error();
    }).catch(() => {
      setShowActionOnly(showActionOnly);
      setSelectionWarning("Your Slate display preference could not be saved.");
    });
  });

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

    await loadWeek(selectedWeek);
  }

  async function submitPicks() {
    setSelectionWarning("");

    if (!week) {
      return;
    }

    setIsSubmitting(true);
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), PICK_SAVE_TIMEOUT_MS);

    try {
      const submission: PickSaveRequest = buildSlateSubmission({
        scoringPeriodId: week.id,
        selections: selectedPicks,
        survivorAvailable,
        survivorHasUnsavedChanges,
        survivorPick,
      });
      const response = await fetchWithSession("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submission),
        signal: request.signal,
      });

      const data = (await response.json().catch(() => ({}))) as PickSaveResponse;

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

  // Stable handlers and one Survivor settings object let each game row skip a
  // redraw unless its own game or picks changed.
  const choose = useStableCallback(chooseTeam);
  const chooseSurvivor = useStableCallback(chooseSurvivorTeam);
  const survivorSettings = useMemo(() => (survivorChipsVisible && survivorStatus !== "eliminated" ? {
    enabled: true,
    interactive: survivorControlsEnabled,
    selectedTeamId: survivorPick?.teamId ?? null,
    savedTeamId: savedSurvivorPick?.teamId ?? null,
    usedTeamIds: survivorUsedTeamIds,
    onChoose: chooseSurvivor,
  } : undefined), [chooseSurvivor, savedSurvivorPick?.teamId, survivorChipsVisible, survivorControlsEnabled, survivorPick?.teamId, survivorStatus, survivorUsedTeamIds]);
  const selectedTeamByGame = useMemo(() => new Map(selectedPicks.map((pick) => [pick.gameId, pick.teamId])), [selectedPicks]);

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
        <SlateHeader
          actionOnlyActive={actionOnlyActive}
          availableWeeks={availableWeeks}
          hasEarlyGame={hasEarlyGame}
          isSubmitting={isSubmitting}
          onChooseWeek={chooseWeek}
          onToggleDisplay={toggleDisplay}
          survivorControlsEnabled={survivorControlsEnabled}
          week={week}
        />

        <SlateReceipt
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          onRemove={removeSelection}
          onSubmit={submitPicks}
          periodType={week?.period_type}
          pickemHasUnsavedChanges={pickemHasUnsavedChanges}
          selectedPickCount={selectedPicks.length}
          selectedTeams={selectedTeams}
          selectionLimit={selectionLimit}
          selectionWarning={selectionWarning}
          survivor={{
            controlsEnabled: survivorControlsEnabled,
            details: survivorPickDetails,
            hasPick: Boolean(survivorPick),
            hasUnsavedChanges: Boolean(survivorHasUnsavedChanges),
            show: Boolean(showSurvivorReceipt),
            status: survivorStatus,
            teamName: survivorTeamName(survivorPick),
          }}
        />

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
          <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 md:mt-8 md:space-y-7" id="slate-matchups">
            {actionOnlyActive && visibleGamesByDay.length === 0 ? (
              <p className="slate-action-empty">Every game still open for selection appears here. Locked games join this view as pool picks become public at kickoff.</p>
            ) : null}
            {visibleGamesByDay.map(([day, dayGames]) => {
              return (
                <section key={day}>
                  <div className="border-y-2 border-[#1d1d1f] px-2 py-1.5 text-center md:px-3 md:py-2">
                    <h2 className="text-xs font-black tracking-[0.18em] text-[#171719] md:text-sm">
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
                        onChoose={choose}
                        selectedTeamId={selectedTeamByGame.get(game.id)}
                        selectionFeedback={selectionFeedback?.gameId === game.id ? selectionFeedback : null}
                        survivor={survivorSettings}
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
