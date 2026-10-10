"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
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
import { decidePickChoice, decideRemoval, decideSurvivorChoice, describeSelectedTeams, filterPoolActionDays, groupGamesByDay, picksDiffer } from "@/lib/slate-view";
import SlateHeader from "@/components/slate-header";
import SeasonClosedBanner from "@/components/season-closed-banner";
import SlateReceipt from "@/components/slate-receipt";
import type { SlateGame as BoardGame, SlateResponse as BoardResponse, SlateScoringPeriod as ScoringPeriod } from "@/lib/api-contracts";
import { initialSlateState, slateReducer, type SelectedPick } from "@/lib/slate-state";
import { FootballLoadingScreen } from "@/components/football-loader";

// A pick save can briefly wait behind database work that is already in
// progress. Keep the request alive long enough for that safe, serialized save
// to return rather than telling a player it failed while the server finishes.
const PICK_SAVE_TIMEOUT_MS = 30_000;

function SlateLoadingShell() {
  return (
    <FootballLoadingScreen background="bg-(color:--themed-bg-18) text-(color:--themed-text-18)" />
  );
}

function isEarlyGame(game: BoardGame) {
  return game.isInternational;
}

export default function BoardPage() {
  // The page's state is one reducer (src/lib/slate-state.ts): what the server said, the draft being edited, what was
  // last saved, which load is current, and the save in flight. The clock ticks on its own.
  const [state, dispatch] = useReducer(slateReducer, initialSlateState);
  const {
    weeks, week, nextWeekAvailableAt, games, showActionOnly, seasonOver, playoffEliminated, survivorUsedTeamIds, survivorAvailable,
    survivorChipsVisible, survivorOnReceipt, survivorStatus, clockSynchronized, isLoading, errorMessage, isSubmitting,
  } = state;
  const { draftPicks: selectedPicks, draftSurvivor: survivorPick, savedPicks, savedSurvivor: savedSurvivorPick, warning: selectionWarning, feedback: selectionFeedback } = state;
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const activeBoardRequest = useRef<AbortController | null>(null);
  const boardRequestId = useRef(0);
  const serverClockOffset = useRef(0);
  const kickoffVisibilityRefreshedGameIds = useRef(new Set<string>());

  async function loadWeek(period: ScoringPeriod) {
    const requestId = boardRequestId.current + 1;
    boardRequestId.current = requestId;
    activeBoardRequest.current?.abort();

    const request = new AbortController();
    activeBoardRequest.current = request;
    const requestTimer = window.setTimeout(() => request.abort(), 15_000);

    dispatch({ type: "load-started", loadId: requestId, week: period });
    kickoffVisibilityRefreshedGameIds.current.clear();

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
        dispatch({ type: "load-failed", loadId: requestId, message: data.error ?? "The Slate could not be loaded." });
        return;
      }

      const serverTime = Date.parse(data.serverTime);
      if (!Number.isFinite(serverTime)) {
        dispatch({ type: "load-failed", loadId: requestId, message: "The Slate clock could not be verified safely." });
        return;
      }

      serverClockOffset.current = serverTime - Date.now();
      setCurrentTime(serverTime);
      kickoffVisibilityRefreshedGameIds.current = new Set(
        data.games
          .filter((game) => Date.parse(game.kickoffAt) <= serverTime)
          .map((game) => game.id),
      );

      dispatch({ type: "board-loaded", loadId: requestId, board: data });
    } catch (error) {
      if (requestId === boardRequestId.current) {
        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return;
        }

        dispatch({ type: "load-failed", loadId: requestId, message: "The Slate is taking too long to load. Please try again." });
      }
    } finally {
      window.clearTimeout(requestTimer);
      if (requestId === boardRequestId.current) activeBoardRequest.current = null;
      dispatch({ type: "load-finished", loadId: requestId });
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
          dispatch({ type: "load-failed", loadId: boardRequestId.current, message: data.error ?? "The Slate could not be loaded." });
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
          dispatch({ type: "load-failed", loadId: boardRequestId.current, message: "The weekly schedule could not be loaded." });
          return;
        }

        serverClockOffset.current = Date.parse(data.serverTime) - Date.now();
        setCurrentTime(Date.parse(data.serverTime));
        kickoffVisibilityRefreshedGameIds.current = new Set(
          data.games
            .filter((game) => Date.parse(game.kickoffAt) <= Date.parse(data.serverTime))
            .map((game) => game.id),
        );
        dispatch({ type: "bootstrap-loaded", loadId: boardRequestId.current, weeks: loadedWeeks, nextWeekAvailableAt: manualAccessAt, week: initialWeek, board: data });
      } catch (error) {
        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return;
        }
        dispatch({ type: "load-failed", loadId: boardRequestId.current, message: "The Slate is taking too long to load. Please try again." });
      } finally {
        if (!disposed) dispatch({ type: "load-finished", loadId: boardRequestId.current });
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
        dispatch({ type: "kickoff-refreshed", loadId: requestId, board: data });
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

  const isReadOnly = week?.status === "complete" || playoffEliminated || seasonOver;
  // The off-season, and a player out of the playoff race, get a quiet page: a banner instead of the receipt.
  const seasonClosedForViewer = seasonOver || playoffEliminated;
  const survivorSelectedGame = survivorPick
    ? games.find((game) => game.id === survivorPick.gameId) ?? null
    : null;
  const savedSurvivorGame = savedSurvivorPick
    ? games.find((game) => game.id === savedSurvivorPick.gameId) ?? null
    : null;
  const survivorLockGame = savedSurvivorGame ?? survivorSelectedGame;
  // The Survivor instructions are for everyone while Survivor is part of the slate, including a player who is already out.
  const survivorHelp = !seasonOver && survivorAvailable && week?.period_type !== "playoff";
  const survivorControlsEnabled = !seasonOver && isSurvivorSlateEditable({
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
  // A finished row is as wide as the pool's two longest picker names on one line (plus a little room), so every row's
  // team line is the same length and a third or fourth name stacks beneath in pairs.
  const slateNamesWidth = (() => {
    const lengths = games.flatMap((game) => [...game.homePickers, ...game.awayPickers]).map((name) => name.length).sort((a, b) => b - a);
    return lengths.length ? ({ "--slate-names-ch": `${Math.ceil((lengths[0] + (lengths[1] ?? lengths[0])) * 1.08 + 3)}` } as CSSProperties) : undefined;
  })();

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
      dispatch({
        type: "draft-reconciled",
        picks: atsDraft.changed ? atsDraft.selections : null,
        survivor: survivorDraft.changed ? { pick: survivorDraft.selection } : null,
        warning: atsDraft.discardedAtKickoff || survivorDraft.discardedAtKickoff
          ? "Kickoff passed. Unsaved changes for that game were discarded; submitted picks remain sealed."
          : null,
      });
    }, 0);

    return () => window.clearTimeout(reconcileTimer);
  }, [clockSynchronized, currentTime, games, isLoading, savedPicks, savedSurvivorPick, selectedPicks, survivorPick]);

  function chooseTeam(gameId: string, teamId: string) {
    if (isReadOnly) return;

    dispatch({ type: "warning-cleared" });

    const choice = decidePickChoice({ picks: selectedPicks, games, gameId, teamId, now: currentTime, limit: selectionLimit });
    switch (choice.kind) {
      case "sealed":
      case "limit":
        dispatch({ type: "warned", message: choice.warning });
        return;
      case "remove":
        dispatch({ type: "pick-removed", gameId, clearFeedback: true });
        return;
      case "swap":
      case "add":
        dispatch({ type: "pick-added", gameId, teamId });
        return;
    }
  }

  function chooseSurvivorTeam(gameId: string, teamId: string) {
    if (!survivorControlsEnabled) return;

    const choice = decideSurvivorChoice({ games, gameId, teamId, now: currentTime, current: survivorPick, saved: savedSurvivorPick, usedTeamIds: survivorUsedTeamIds });
    if (choice.kind === "ignore") return;
    if (choice.kind === "warn") {
      dispatch({ type: "warned", message: choice.warning });
      return;
    }

    dispatch({ type: "survivor-chosen", pick: { gameId, teamId } });
  }

  function removeSelection(gameId: string) {
    dispatch({ type: "warning-cleared" });
    const removal = decideRemoval({ games, gameId, now: currentTime });
    if (!removal.allowed) {
      dispatch({ type: "warned", message: removal.warning });
      return;
    }
    dispatch({ type: "pick-removed", gameId, clearFeedback: false });
  }

  // Flip between All Games and Pool Action, and remember the choice.
  const toggleDisplay = useStableCallback(() => {
    const next = !showActionOnly;
    dispatch({ type: "display-changed", showActionOnly: next });
    void fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showPoolAction: next }) }).then(async (response) => {
      if (!response.ok) throw new Error();
    }).catch(() => {
      dispatch({ type: "display-changed", showActionOnly });
      dispatch({ type: "warned", message: "Your Slate display preference could not be saved." });
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
    if (!week) {
      return;
    }

    // What is sent is what gets recorded as saved, even if the draft changes while the save is in flight.
    const sentPicks = selectedPicks;
    const sentSurvivor = survivorAvailable ? { pick: survivorPick } : null;
    const loadId = boardRequestId.current;
    dispatch({ type: "submit-started" });
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), PICK_SAVE_TIMEOUT_MS);

    try {
      const response = await fetchWithSession("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...buildSlateSubmission({
            scoringPeriodId: week.id,
            selections: sentPicks,
            survivorAvailable,
            survivorHasUnsavedChanges,
            survivorPick,
          }),
        }),
        signal: request.signal,
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        dispatch({ type: "submit-failed", message: data.error ?? "Your picks could not be saved. Please try again." });
        return;
      }

      dispatch({ type: "submit-succeeded", picks: sentPicks, survivor: sentSurvivor });
    } catch (error) {
      if (error instanceof SessionUnavailableError) {
        window.location.replace("/login");
        dispatch({ type: "submit-failed", message: "" });
        return;
      }

      dispatch({ type: "submit-failed", message: "Your picks are taking too long to save. Please try again." });
      // The save may have gone through even though its answer never arrived. Read what the server holds before
      // offering another submission: if it matches what was sent, the save worked and nothing is left unsaved.
      void confirmSaveOutcome(week.id, loadId, sentPicks);
    } finally {
      window.clearTimeout(requestTimer);
    }
  }

  async function confirmSaveOutcome(weekId: string, loadId: number, sentPicks: SelectedPick[]) {
    try {
      const response = await fetchWithSession(`/api/board?scoringPeriodId=${weekId}`, { cache: "no-store" });
      if (!response.ok) return;
      const board = (await response.json()) as BoardResponse;
      if (loadId !== boardRequestId.current) return;
      dispatch({ type: "saved-state-read", loadId, board });
      if (!picksDiffer(board.myPicks, sentPicks)) dispatch({ type: "warning-cleared" });
    } catch {
      // The player can retry; the draft is untouched either way.
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
      <main className="min-h-screen bg-(color:--themed-bg-18) p-8 text-(color:--themed-text-18)">
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
    <main className="min-h-screen bg-(color:--themed-bg-14) text-(color:--themed-text-18)">
      <div className="mx-auto max-w-5xl border-x border-(color:--themed-border-10) bg-(color:--themed-bg-20) px-4 pb-0 pt-5 sm:px-5 sm:pb-0 sm:pt-8 md:px-10">
        {seasonClosedForViewer ? <div className="mt-5"><SeasonClosedBanner eliminated={!seasonOver} /></div> : null}

        <SlateHeader
          actionOnlyActive={actionOnlyActive}
          availableWeeks={availableWeeks}
          hasEarlyGame={hasEarlyGame}
          onChooseWeek={chooseWeek}
          onToggleDisplay={toggleDisplay}
          readOnly={seasonClosedForViewer}
          survivorHelp={survivorHelp}
          week={week}
        />

        {seasonClosedForViewer ? null : <SlateReceipt
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
        />}

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
          <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 md:mt-8 md:space-y-7" id="slate-matchups" style={slateNamesWidth}>
            {actionOnlyActive && visibleGamesByDay.length === 0 ? (
              <p className="slate-action-empty">Every game still open for selection appears here. Locked games join this view as pool picks become public at kickoff.</p>
            ) : null}
            {visibleGamesByDay.map(([day, dayGames]) => {
              return (
                <section key={day}>
                  <div className="border-y-2 border-(color:--themed-border-10) px-2 py-1.5 text-center md:px-3 md:py-2">
                    <h2 className="text-xs font-black tracking-[0.18em] text-(color:--themed-text-18) md:text-sm">
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
