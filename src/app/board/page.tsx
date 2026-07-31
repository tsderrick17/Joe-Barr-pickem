"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWithSession,
  getFreshSession,
  SessionUnavailableError,
} from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { helmetShellColor } from "@/lib/nfl-helmet-colors";
import SlateGameRow from "@/components/slate-game-row";

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
  games: BoardGame[];
  myPicks: SelectedPick[];
  pickem: {
    playoffEliminated: boolean;
  };
  survivor: {
    available: boolean;
    notice: string | null;
    status: "active" | "eliminated" | "complete";
    pick: { game_id: string; selected_team_id: string } | null;
    usedTeamIds: string[];
  };
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

function easternTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function isEarlyGame(game: BoardGame) {
  return game.isInternational;
}

// Retained for the adjacent Survivor rendering branch until that presentation is extracted.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function easternLockLabel(value: string) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

  return `${date} · ${time.replace(":00", "")}`;
}

// Retained for the adjacent Survivor rendering branch until that presentation is extracted.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resultMarker(result: "win" | "loss" | null) {
  if (!result) return null;

  return (
    <strong
      aria-label={`Against the spread: ${result}`}
      className={`relative -top-1 -ml-px inline-block -rotate-[10deg] text-sm font-black leading-none sm:text-base ${
        result === "win" ? "text-green-700" : "text-red-700"
      }`}
    >
      {result === "win" ? "W" : "L"}
    </strong>
  );
}

function teamLogoUrl(abbreviation: string) {
  return `/team-logos/${abbreviation}.png`;
}

function HelmetIcon({
  abbreviation,
  faces,
  unavailable = false,
}: {
  abbreviation: string;
  faces: "left" | "right";
  unavailable?: boolean;
}) {
  const flipped = faces === "left";
  const shellColor = helmetShellColor(abbreviation, "#ffffff");
  return (
    <span aria-hidden="true" className={`relative block h-12 w-[3.9rem] shrink-0 ${flipped ? "-scale-x-100" : ""} ${unavailable ? "grayscale" : ""}`}>
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: shellColor,
          maskImage: "url(/helmet-newspaper-template.png)",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: "url(/helmet-newspaper-template.png)",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
      />
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: "#ffffff",
          clipPath: "polygon(27% 57%, 100% 57%, 100% 100%, 27% 100%)",
          maskImage: "url(/helmet-newspaper-template.png)",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: "url(/helmet-newspaper-template.png)",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
      />
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: "#ffffff",
          clipPath: "polygon(53% 29%, 100% 29%, 100% 62%, 69% 62%, 59% 53%, 52% 48%)",
          maskImage: "url(/helmet-newspaper-template.png)",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: "url(/helmet-newspaper-template.png)",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
      />
      <Image alt="" className="absolute inset-0 h-full w-full object-contain mix-blend-multiply" height={48} src="/helmet-newspaper-template.png" width={63} />
      <Image alt="" className="absolute left-[15%] top-[18%] h-[42%] w-[38%] object-contain" height={24} src={teamLogoUrl(abbreviation)} width={24} />
    </span>
  );
}

export default function BoardPage() {
  const [weeks, setWeeks] = useState<ScoringPeriod[]>([]);
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [showActionOnly, setShowActionOnly] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([]);
  const [savedPicks, setSavedPicks] = useState<SelectedPick[]>([]);
  const [survivorPick, setSurvivorPick] = useState<SelectedPick | null>(null);
  const [savedSurvivorPick, setSavedSurvivorPick] = useState<SelectedPick | null>(null);
  const [survivorUsedTeamIds, setSurvivorUsedTeamIds] = useState<string[]>([]);
  const [survivorAvailable, setSurvivorAvailable] = useState(true);
  const [survivorStatus, setSurvivorStatus] = useState<"active" | "eliminated" | "complete">("active");
  const [survivorNotice, setSurvivorNotice] = useState<string | null>(null);
  const [playoffEliminated, setPlayoffEliminated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionWarning, setSelectionWarning] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [selectionFeedback, setSelectionFeedback] = useState<{ gameId: string; teamId: string; type: "sweep"; token: number } | null>(null);
  const activeBoardRequest = useRef<AbortController | null>(null);
  const boardRequestId = useRef(0);
  const selectionFeedbackToken = useRef(0);

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
    setSubmissionMessage("");
    setPlayoffEliminated(false);
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

      setGames(data.games);
      setPlayoffEliminated(data.pickem.playoffEliminated);
      setSelectedPicks(data.myPicks);
      setSavedPicks(data.myPicks);
      setSurvivorPick(data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null);
      setSavedSurvivorPick(data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null);
      setSurvivorUsedTeamIds(data.survivor.usedTeamIds);
      setSurvivorAvailable(data.survivor.available);
      setSurvivorStatus(data.survivor.status);
      setSurvivorNotice(data.survivor.notice);
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
    async function loadBoard() {
      const session = await getFreshSession();

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .select("id")
        .eq("year", CURRENT_SEASON_YEAR)
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

      await loadWeek(initialWeek);
    }

    void loadBoard();
  }, []);

  useEffect(() => {
    const refreshTime = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(refreshTime);
  }, []);

  const availableWeeks = useMemo(() => {
    const currentWeek = selectDefaultScoringPeriod(weeks);

    return weeks.filter(
      (period) =>
        period.status === "complete" ||
        period.id === currentWeek?.id,
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

  // Temporary visual preview: remove this override when the commissioner is ready
  // to return the All Games / Pool Action switch to its first-gameday release.
  const previewActionSwitch = true;

  const actionSwitchAvailable = useMemo(() => {
    if (previewActionSwitch) return games.length > 0;
    if (!games.length) return false;
    const firstKickoff = games.reduce((earliest, game) =>
      new Date(game.kickoffAt).getTime() < new Date(earliest.kickoffAt).getTime() ? game : earliest,
    );

    return easternCalendarDate(currentTime) >= easternCalendarDate(firstKickoff.kickoffAt);
  }, [currentTime, games, previewActionSwitch]);

  const actionOnlyActive = actionSwitchAvailable && showActionOnly;

  const visibleGamesByDay = useMemo(() => {
    if (!actionOnlyActive) return gamesByDay;

    return gamesByDay
      .map(([day, dayGames]) => [
        day,
        dayGames.filter((game) => {
          const stillOpenForSelection = new Date(game.kickoffAt) > new Date();
          const hasPublishedPoolAction = game.awayPickers.length > 0 || game.homePickers.length > 0;
          return stillOpenForSelection || hasPublishedPoolAction;
        }),
      ] as const)
      .filter(([, dayGames]) => dayGames.length > 0);
  }, [actionOnlyActive, gamesByDay]);

  const selectedTeams = useMemo(() => {
    return selectedPicks
      .map((pick) => {
        const game = games.find((item) => item.id === pick.gameId);

        if (!game) return null;
        const isHome = pick.teamId === game.homeTeamId;
        const isAway = pick.teamId === game.awayTeamId;
        const name = isHome
          ? game.homeTeam
          : isAway
            ? game.awayTeam
            : null;

        if (!name) return null;

        return {
          gameId: pick.gameId,
          name,
          abbreviation: isHome ? game.homeTeamAbbreviation : game.awayTeamAbbreviation,
          canRemove: new Date(game.kickoffAt) > new Date(),
        };
      })
      .filter(Boolean) as { gameId: string; name: string; abbreviation: string; canRemove: boolean }[];
  }, [games, selectedPicks]);

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
  const survivorTeamName = (pick: SelectedPick | null) => {
    if (!pick) return "";
    const game = games.find((item) => item.id === pick.gameId);
    return pick.teamId === game?.awayTeamId ? game.awayTeam : pick.teamId === game?.homeTeamId ? game.homeTeam : "";
  };
  const pickemReceipt = selectedTeams.map((team) => team.name).join(" · ") || "OPEN";
  const pickemReceiptShort = selectedTeams.map((team) => team.abbreviation).join(", ") || "OPEN";
  const survivorReceipt = survivorTeamName(survivorPick) || (survivorStatus === "complete" ? "COMPLETE" : survivorStatus === "eliminated" ? "OUT" : "OPEN");
  const survivorReceiptShort = (() => {
    if (!survivorPick) return survivorReceipt;
    const game = games.find((item) => item.id === survivorPick.gameId);
    return survivorPick.teamId === game?.awayTeamId
      ? game.awayTeamAbbreviation
      : survivorPick.teamId === game?.homeTeamId
        ? game.homeTeamAbbreviation
        : survivorReceipt;
  })();
  const hasEarlyGame = games.some(isEarlyGame);
  function showSelectionFeedback(gameId: string, teamId: string, type: "sweep") {
    selectionFeedbackToken.current += 1;
    setSelectionFeedback({ gameId, teamId, type, token: selectionFeedbackToken.current });
  }

  function chooseTeam(gameId: string, teamId: string) {
    if (isReadOnly) return;

    setSelectionWarning("");
    setSubmissionMessage("");

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

  function removeSelection(gameId: string) {
    setSelectionWarning("");
    setSubmissionMessage("");
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
    setSubmissionMessage("");

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

      setSubmissionMessage(data.message ?? "Your picks have been saved.");
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
    <main className="min-h-screen bg-[#e9e2d3] text-[#171719]">
      <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 pb-0 pt-5 sm:px-5 sm:pb-0 sm:pt-8 md:px-10">
        <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10">
          <div className="slate-header-grid grid gap-5 md:gap-0">
            <div className="min-w-0 md:pr-7">
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">
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
                <div className={`slate-view-switch slate-view-switch--header ${actionOnlyActive ? "is-action-only" : ""}`} aria-label="Slate display" role="group">
                  <span className={!actionOnlyActive ? "is-active" : ""}>ALL GAMES</span>
                  <button aria-checked={actionOnlyActive} aria-label={actionOnlyActive ? "Show all games" : "Show pool action"} onClick={() => setShowActionOnly((current) => !current)} role="switch" type="button"><span /></button>
                  <span className={actionOnlyActive ? "is-active" : ""}>POOL ACTION</span>
                </div>
              ) : null}
            </div>

            <aside className="border-t border-[#b7aea0] pt-4 text-left text-xs leading-5 text-slate-700 md:col-span-2 md:self-stretch md:border-l md:border-t-0 md:pt-0">
              <p className="md:col-span-2 md:pl-4 font-bold tracking-[0.12em] text-[#171719]">HOW TO PLAY</p>
              <div className="slate-how-to-grid mt-2 grid gap-3 border-t border-[#b7aea0] pt-3 sm:gap-0">
                <div className="md:pl-4">
                  <p>Lines lock at 8 AM ET on gameday, unless otherwise noted.</p>
                  <p className="mt-1"><span className="font-semibold text-[#00756e]">Teal lines</span> are official and will not change.</p>
                  <p className="mt-1">Selections are revealed to others at kickoff.</p>
                </div>
                <div className="border-t border-[#b7aea0] pt-3 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
                  <p>Favorites left; home team ALL CAPS.</p>
                  <p className="mt-1">
                    {week.period_type === "playoff"
                      ? "Pick every playoff game. Save early or one at a time."
                      : "Choose TWO teams and click Save below."}
                  </p>
                  <p className="mt-1">Changes allowed until kickoff time.</p>
                </div>
              </div>
              {hasEarlyGame ? (
                <p className="mt-3 border-t border-[#b7aea0] pt-3 font-semibold md:pl-4">
                  EARLY GAME: spreads post at 6 PM ET the night before.
                </p>
              ) : null}
            </aside>
          </div>

        </header>

        <nav aria-label="Your weekly controls" className="slate-mini-nav slate-receipt-grid">
          <Link href="/#my-ticket">
            <span>YOUR RECEIPT</span>
            <strong>VIEW FULL TICKET</strong>
          </Link>
          <a href="#slate-matchups">
            <span>PICK&apos;EM</span>
            <strong className={pickemHasUnsavedChanges ? "is-unsaved" : selectedPicks.length === selectionLimit ? "is-complete" : "is-due"}>
              <span className="slate-receipt-picks-full">{pickemReceipt}</span>
              <span className="slate-receipt-picks-short">{pickemReceiptShort}</span>
            </strong>
            <em>{pickemHasUnsavedChanges ? "UNSAVED CHANGE" : selectedPicks.length ? "SAVED" : "PICK DUE"}</em>
          </a>
          {week.period_type === "playoff" ? (
            <a href="#slate-matchups">
              <span>PLAYOFF ROUND</span>
              <strong className={pickemHasUnsavedChanges ? "is-unsaved" : selectedPicks.length === selectionLimit ? "is-complete" : "is-due"}>{selectedPicks.length}/{selectionLimit} GAMES</strong>
              <em>{pickemHasUnsavedChanges ? "UNSAVED CHANGE" : selectedPicks.length === selectionLimit ? "ROUND FILLED" : "GAMES DUE"}</em>
            </a>
          ) : (
            <Link href="/survivor">
              <span>SURVIVOR</span>
              <strong className={survivorHasUnsavedChanges ? "is-unsaved" : survivorReceipt === "OPEN" ? "is-due" : survivorReceipt === "OUT" ? "is-out" : survivorReceipt === "COMPLETE" ? "is-quiet" : "is-complete"}>
                <span className="slate-receipt-picks-full">{survivorReceipt}</span>
                <span className="slate-receipt-picks-short">{survivorReceiptShort}</span>
              </strong>
              <em>{survivorHasUnsavedChanges ? "UNSAVED CHANGE" : survivorReceipt === "OPEN" ? "PICK DUE" : survivorReceipt === "OUT" || survivorReceipt === "COMPLETE" ? "" : "SAVED"}</em>
            </Link>
          )}
        </nav>

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
            {false ? (
              <section className="border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
                <h2 className="font-serif text-xl font-bold">
                  Survivor is temporarily unavailable
                </h2>
                <p className="mt-1 text-sm font-semibold">
                  {survivorNotice ??
                    "Your ATS slate is still available and can be saved safely."}
                </p>
              </section>
            ) : false ? (
              <section aria-labelledby="survivor-wire-heading" className="newspaper-clipping survivor-clipping p-2.5 sm:p-3">
                <div className="flex items-center justify-between gap-3 border-b-2 border-[#1d1d1f] pb-1.5">
                  <h2 className="font-serif text-xl font-black leading-none sm:text-2xl" id="survivor-wire-heading">Survivor Table</h2>
                  <p className="text-right text-[9px] font-black uppercase tracking-[0.1em] text-[#29251d] sm:text-[10px]">Straight-up · {week?.display_name}</p>
                </div>
                <div className="mt-2 divide-y divide-[#1d1d1f] border-y border-[#1d1d1f]">
                  {games.map((game) => {
                    const gameHasStarted = new Date(game.kickoffAt) <= new Date();
                    const favoriteIsHome = game.favoriteTeamId === game.homeTeamId;
                    const leftTeamId = favoriteIsHome ? game.homeTeamId : game.awayTeamId;
                    const leftTeamName = favoriteIsHome ? game.homeTeam : game.awayTeam;
                    const leftTeamAbbreviation = favoriteIsHome ? game.homeTeamAbbreviation : game.awayTeamAbbreviation;
                    const rightTeamId = favoriteIsHome ? game.awayTeamId : game.homeTeamId;
                    const rightTeamName = favoriteIsHome ? game.awayTeam : game.homeTeam;
                    const rightTeamAbbreviation = favoriteIsHome ? game.awayTeamAbbreviation : game.homeTeamAbbreviation;
                    const leftSelected = survivorPick?.teamId === leftTeamId;
                    const rightSelected = survivorPick?.teamId === rightTeamId;
                    const leftUsed = survivorUsedTeamIds.includes(leftTeamId) && !leftSelected;
                    const rightUsed = survivorUsedTeamIds.includes(rightTeamId) && !rightSelected;
                    const leftUnavailable = leftUsed || gameHasStarted;
                    const rightUnavailable = rightUsed || gameHasStarted;
                    return (
                      <article className="relative py-1" key={game.id}>
                        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundImage: `linear-gradient(90deg, ${helmetShellColor(leftTeamAbbreviation)} 0 50%, ${helmetShellColor(rightTeamAbbreviation)} 50% 100%)` }} />
                        <p className="sr-only">{easternTime(game.kickoffAt)}</p>
                        <div className="grid grid-cols-2 divide-x divide-[#1d1d1f]">
                          <button aria-label={`Choose ${leftTeamName} as your straight-up Survivor winner`} aria-pressed={leftSelected} className={`flex min-h-14 items-center justify-center px-2 py-1.5 transition ${leftSelected ? "survivor-team-selection bg-[#1d1d1f]" : "bg-white hover:bg-zinc-100"} disabled:cursor-not-allowed`} disabled={leftUnavailable} onClick={() => setSurvivorPick(leftSelected ? null : { gameId: game.id, teamId: leftTeamId })} title={leftUnavailable ? `${leftTeamName} is unavailable` : `Choose ${leftTeamName}`} type="button">
                            <HelmetIcon abbreviation={leftTeamAbbreviation} faces="right" unavailable={leftUnavailable} />
                          </button>
                          <button aria-label={`Choose ${rightTeamName} as your straight-up Survivor winner`} aria-pressed={rightSelected} className={`flex min-h-14 items-center justify-center px-2 py-1.5 transition ${rightSelected ? "survivor-team-selection bg-[#1d1d1f]" : "bg-white hover:bg-zinc-100"} disabled:cursor-not-allowed`} disabled={rightUnavailable} onClick={() => setSurvivorPick(rightSelected ? null : { gameId: game.id, teamId: rightTeamId })} title={rightUnavailable ? `${rightTeamName} is unavailable` : `Choose ${rightTeamName}`} type="button">
                            <HelmetIcon abbreviation={rightTeamAbbreviation} faces="left" unavailable={rightUnavailable} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
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
                        hasStarted={new Date(game.kickoffAt) <= new Date()}
                        key={game.id}
                        onChoose={chooseTeam}
                        selectedTeamId={selectedPicks.find((pick) => pick.gameId === game.id)?.teamId}
                        selectionFeedback={selectionFeedback?.gameId === game.id ? selectionFeedback : null}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {!isReadOnly ? (
        <aside className="slate-selection-footer fixed inset-x-0 bottom-0 border-t-2 border-[#1d1d1f] bg-[#f5f0e6] shadow-[0_-8px_24px_rgba(0,0,0,0.1)]">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-5 sm:py-4 md:px-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-[0.14em] text-slate-600">
                  YOUR PICKS · {selectedPicks.length} OF {selectionLimit}
                </p>

                <ol className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-700 sm:mt-2 sm:gap-2 sm:text-sm">
                  {selectedTeams.length ? (
                    selectedTeams.map((team, index) => (
                      <li className="selection-chip flex items-center gap-1 border border-slate-400 bg-white py-1 pl-2 pr-1" key={team.gameId}>
                        <span>{index + 1}. {team.name}</span>
                        {team.canRemove ? (
                          <button
                            aria-label={`Remove ${team.name}`}
                            className="ml-0.5 inline-flex size-5 items-center justify-center rounded-sm text-base leading-none text-slate-600 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-800"
                            onClick={() => removeSelection(team.gameId)}
                            type="button"
                          >
                            ×
                          </button>
                        ) : null}
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
