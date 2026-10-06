"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  fetchWithSession,
  SessionUnavailableError,
} from "@/lib/auth-session";
import {
  reconcileAtsDraftAtKickoff,
  reconcileSurvivorDraftAtKickoff,
} from "@/lib/slate-draft-locks";
import { buildSlateSubmission } from "@/lib/slate-submission";
import { isSurvivorSlateEditable } from "@/lib/survivor-availability";
import SlateGameRow from "@/components/slate-game-row";
import { useStableCallback } from "@/lib/use-stable-callback";
import { decidePickChoice, decideRemoval, decideSurvivorChoice, describeSelectedTeams, filterPoolActionDays, groupGamesByDay, picksDiffer } from "@/lib/slate-view";
import { confirmsSlateSubmission, type SlateSaveVerification } from "@/lib/slate-save-verification";
import SlateHeader from "@/components/slate-header";
import SlateReceipt from "@/components/slate-receipt";
import type { PickSaveRequest, PickSaveResponse, ProfileUpdateRequest, SlateGame as BoardGame, SlateResponse as BoardResponse } from "@/lib/api-contracts";
import { initialSlateSelectionState, slateSelectionReducer, type SlatePick } from "@/lib/slate-selection-state";
import { useSlateBoardData } from "@/lib/use-slate-board-data";

// A pick save can briefly wait behind database work that is already in
// progress. Keep the request alive long enough for that safe, serialized save
// to return rather than telling a player it failed while the server finishes.
const PICK_SAVE_TIMEOUT_MS = 30_000;
const SAVE_VERIFY_TIMEOUT_MS = 8_000;

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
  const [showActionOnly, setShowActionOnly] = useState(false);
  const showActionOnlyOverride = useRef<boolean | null>(null);
  const [isSavingDisplayPreference, setIsSavingDisplayPreference] = useState(false);
  const [selectionState, dispatchSelections] = useReducer(slateSelectionReducer, initialSlateSelectionState);
  const { selectedPicks, savedPicks, survivorPick, savedSurvivorPick } = selectionState;
  const [survivorUsedTeamIds, setSurvivorUsedTeamIds] = useState<string[]>([]);
  const [survivorAvailable, setSurvivorAvailable] = useState(true);
  const [survivorChipsVisible, setSurvivorChipsVisible] = useState(true);
  const [survivorOnReceipt, setSurvivorOnReceipt] = useState(true);
  const [survivorStatus, setSurvivorStatus] = useState<"active" | "eliminated" | "complete">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectionWarning, setSelectionWarning] = useState("");
  const [saveVerificationRequiredForPeriod, setSaveVerificationRequiredForPeriod] = useState<string | null>(null);
  const [selectionFeedback, setSelectionFeedback] = useState<{ gameId: string; teamId: string; type: "sweep"; token: number } | null>(null);
  const selectionFeedbackToken = useRef(0);

  // Board reads own public game data. This callback hydrates only the
  // player-specific picks and preferences, never called by kickoff refreshes.
  const applyPlayerBoard = useStableCallback((data: BoardResponse) => {
    const pick = data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null;
    setShowActionOnly(showActionOnlyOverride.current ?? Boolean(data.showPoolAction));
    dispatchSelections({ type: "hydrate", picks: data.myPicks, survivorPick: pick });
    setSurvivorUsedTeamIds(data.survivor.usedTeamIds);
    setSurvivorAvailable(data.survivor.available);
    setSurvivorChipsVisible(data.survivor.chipsVisible !== false);
    setSurvivorOnReceipt(data.survivor.showOnReceipt !== false);
    setSurvivorStatus(data.survivor.status);
  });
  const {
    availableWeeks,
    clockSynchronized,
    currentTime,
    errorMessage,
    games,
    isLoading,
    loadWeek,
    playoffEliminated,
    week,
    weeks,
  } = useSlateBoardData(applyPlayerBoard);

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
  const survivorTeamName = (pick: SlatePick | null) => {
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
      if (atsDraft.changed) dispatchSelections({ type: "reconcile-picks", picks: atsDraft.selections });
      if (survivorDraft.changed) dispatchSelections({ type: "reconcile-survivor", pick: survivorDraft.selection });
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
        dispatchSelections({ type: "remove-pick", gameId });
        setSelectionFeedback(null);
        return;
      case "swap":
      case "add":
        dispatchSelections({ type: "choose-pick", gameId, teamId });
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
    dispatchSelections({ type: "choose-survivor", pick: { gameId, teamId } });
  }

  function removeSelection(gameId: string) {
    setSelectionWarning("");
    const removal = decideRemoval({ games, gameId, now: currentTime });
    if (!removal.allowed) {
      setSelectionWarning(removal.warning);
      return;
    }
    dispatchSelections({ type: "remove-pick", gameId });
  }

  // Flip between All Games and Pool Action, and remember the choice.
  const toggleDisplay = useStableCallback(() => {
    if (isSavingDisplayPreference) return;

    const previous = showActionOnly;
    const next = !showActionOnly;
    showActionOnlyOverride.current = next;
    setIsSavingDisplayPreference(true);
    setShowActionOnly(next);
    const update: ProfileUpdateRequest = { showPoolAction: next };
    void fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) }).then(async (response) => {
      if (!response.ok) throw new Error();
    }).catch(() => {
      showActionOnlyOverride.current = previous;
      setShowActionOnly(previous);
      setSelectionWarning("Your Slate display preference could not be saved.");
    }).finally(() => {
      setIsSavingDisplayPreference(false);
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

    setSelectionWarning("");
    const loaded = await loadWeek(selectedWeek);
    if (loaded) {
      setSaveVerificationRequiredForPeriod((current) => current === selectedWeek.id ? null : current);
    }
  }

  async function verifySubmittedPicks(
    scoringPeriodId: string,
    submittedPicks: SlatePick[],
    submittedSurvivorPick: SlatePick | null,
    verifySurvivor: boolean,
  ): Promise<SlateSaveVerification> {
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), SAVE_VERIFY_TIMEOUT_MS);

    try {
      const response = await fetchWithSession(
        `/api/board?scoringPeriodId=${encodeURIComponent(scoringPeriodId)}`,
        { signal: request.signal },
      );
      if (!response.ok) return { kind: "unavailable" };

      const data: unknown = await response.json();
      return confirmsSlateSubmission(
        data,
        submittedPicks,
        verifySurvivor ? submittedSurvivorPick : undefined,
      );
    } catch (error) {
      if (error instanceof SessionUnavailableError) window.location.replace("/login");
      return { kind: "unavailable" };
    } finally {
      window.clearTimeout(requestTimer);
    }
  }

  async function submitPicks() {
    setSelectionWarning("");

    if (!week) {
      return;
    }
    if (saveVerificationRequiredForPeriod === week.id) {
      setSelectionWarning("Refresh this week before submitting again so its saved picks can be verified.");
      return;
    }

    setIsSubmitting(true);
    const submittedWeekId = week.id;
    const submittedPicks = selectedPicks;
    const submittedSurvivorPick = survivorPick;
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), PICK_SAVE_TIMEOUT_MS);

    function applyVerifiedSave() {
      setSaveVerificationRequiredForPeriod(null);
      dispatchSelections({
        type: "save-succeeded",
        submittedPicks,
        ...(survivorAvailable && survivorHasUnsavedChanges ? { submittedSurvivorPick } : {}),
      });
    }

    function applyObservedSaveState(verification: SlateSaveVerification) {
      if (verification.kind !== "different") return;
      dispatchSelections({
        type: "observe-server-state",
        picks: verification.savedPicks,
        ...(Object.hasOwn(verification, "savedSurvivorPick") ? { survivorPick: verification.savedSurvivorPick } : {}),
      });
    }

    try {
      const submission: PickSaveRequest = buildSlateSubmission({
        scoringPeriodId: week.id,
        selections: submittedPicks,
        survivorAvailable,
        survivorHasUnsavedChanges,
        survivorPick: submittedSurvivorPick,
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
        if (response.status >= 500) {
          const verification = await verifySubmittedPicks(
            submittedWeekId,
            submittedPicks,
            submittedSurvivorPick,
            Object.hasOwn(submission, "survivorSelection"),
          );
          if (verification.kind === "confirmed") {
            applyVerifiedSave();
            setSelectionWarning("The save response failed, but a follow-up check confirmed your picks were saved.");
            return;
          }
          applyObservedSaveState(verification);
          setSaveVerificationRequiredForPeriod(verification.kind === "unavailable" ? submittedWeekId : null);
          setSelectionWarning(verification.kind === "different"
            ? "Your saved picks have been refreshed after an interrupted save. Review the receipt before submitting again."
            : "We couldn't confirm whether your picks were saved. Refresh The Slate before submitting again.");
          return;
        }
        setSelectionWarning(
          data.error ?? "Your picks could not be saved. Please try again.",
        );
        return;
      }

      dispatchSelections({
        type: "save-succeeded",
        submittedPicks,
        ...(survivorAvailable ? { submittedSurvivorPick } : {}),
      });
    } catch (error) {
      if (error instanceof SessionUnavailableError) {
        window.location.replace("/login");
        return;
      }

      const verification = await verifySubmittedPicks(
        submittedWeekId,
        submittedPicks,
        submittedSurvivorPick,
        survivorAvailable && survivorHasUnsavedChanges,
      );
      if (verification.kind === "confirmed") {
        applyVerifiedSave();
        setSelectionWarning("The save response was interrupted, but a follow-up check confirmed your picks were saved.");
      } else {
        applyObservedSaveState(verification);
        setSaveVerificationRequiredForPeriod(submittedWeekId);
        setSelectionWarning(verification.kind === "different"
          ? "The save may still be finishing. Refresh this week before submitting again."
          : "We couldn't confirm whether your picks were saved. Refresh The Slate before submitting again.");
      }
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
          isSavingDisplayPreference={isSavingDisplayPreference}
          isSubmitting={isSubmitting}
          onChooseWeek={chooseWeek}
          onToggleDisplay={toggleDisplay}
          survivorControlsEnabled={survivorControlsEnabled}
          week={week}
        />

        <SlateReceipt
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          saveVerificationRequired={saveVerificationRequiredForPeriod === week?.id}
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
