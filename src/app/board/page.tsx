"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWithSession,
  getFreshSession,
  SessionUnavailableError,
} from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { helmetShellColor } from "@/lib/nfl-helmet-colors";
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

function SlateLoadingShell() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[#e9e2d3] text-[#171719]">
      <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 pb-0 pt-5 sm:px-5 sm:pt-8 md:px-10">
        <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10">
          <div className="slate-header-grid grid gap-5 md:gap-0">
            <div className="min-w-0 md:pr-7">
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">The Slate</h1>
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

      const requestedWeekId = new URLSearchParams(window.location.search).get("week");
      const requestedWeek = requestedWeekId
        ? loadedWeeks.find((period) => period.id === requestedWeekId && period.status === "complete")
        : null;
      const initialWeek = requestedWeek ?? selectDefaultScoringPeriod(loadedWeeks);

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
          canRemove: new Date(game.kickoffAt) > new Date(),
          isSaved,
        };
      })
      .filter(Boolean) as { gameId: string; name: string; abbreviation: string; lineValue: string | null; isLineLocked: boolean; canRemove: boolean; isSaved: boolean }[];
  }, [games, savedPicks, selectedPicks]);

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
  const survivorControlsEnabled = isSurvivorSlateEditable({
    periodType: week?.period_type,
    periodStatus: week?.status,
    survivorAvailable,
    survivorStatus,
    selectedGameKickoffAt: survivorSelectedGame?.kickoffAt ?? null,
    now: new Date(currentTime),
  });
  const survivorTeamName = (pick: SelectedPick | null) => {
    if (!pick) return "";
    const game = games.find((item) => item.id === pick.gameId);
    return pick.teamId === game?.awayTeamId ? game.awayTeam : pick.teamId === game?.homeTeamId ? game.homeTeam : "";
  };
  const pickemReceipt = selectedTeams.map((team) => team.abbreviation).join(" · ") || "OPEN";
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
  // Saved selections arrive asynchronously. Keep the receipt neutral until
  // they do so, rather than briefly presenting an incorrect OPEN ticket.
  const receiptIsLoading = isLoading;
  const receiptNeedsSaving = hasUnsavedChanges;
  const receiptIsReprint = savedPicks.length > 0 || Boolean(savedSurvivorPick);
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
    setSubmissionMessage("");
    setSurvivorPick({ gameId, teamId });
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

              <div className="slate-view-switch-slot">
                {actionSwitchAvailable ? (
                  <div className={`slate-view-switch slate-view-switch--header ${actionOnlyActive ? "is-action-only" : ""}`} aria-label="Slate display" role="group">
                    <span className={!actionOnlyActive ? "is-active" : ""}>ALL GAMES</span>
                    <button aria-checked={actionOnlyActive} aria-label={actionOnlyActive ? "Show all games" : "Show pool action"} onClick={() => setShowActionOnly((current) => !current)} role="switch" type="button"><span /></button>
                    <span className={actionOnlyActive ? "is-active" : ""}>POOL ACTION</span>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="border-t border-[#b7aea0] pt-4 text-left text-xs leading-5 text-slate-700 md:col-span-2 md:self-stretch md:border-l md:border-t-0 md:pt-0">
              <div className={`slate-action-instructions ${survivorControlsEnabled ? "has-survivor" : ""} mt-0 grid gap-2 border-y-2 border-[#1d1d1f] bg-[#eee4d1] px-3 py-2.5 text-[11px] leading-4 text-[#17354d] sm:text-xs ${survivorControlsEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">PICK&apos;EM</strong>Click a team name to make your against-the-spread pick{week?.period_type === "playoff" ? " for every playoff game" : "s"}.</p>
                {survivorControlsEnabled ? <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">SURVIVOR</strong>Click a poker chip to choose one outright winner.</p> : null}
                <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">PRINT</strong>Review your choices, then click <span className="font-black">Print Ticket</span> to save your receipt.</p>
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
              </div>
              {hasEarlyGame ? (
                <p className="mt-3 border-t border-[#b7aea0] pt-3 font-semibold md:pl-4">
                  EARLY GAME: spreads post at 6 PM ET the night before.
                </p>
              ) : null}
            </aside>
          </div>

        </header>

        <section aria-label="Your weekly receipt" className={`slate-mini-nav slate-receipt-strip ${receiptIsLoading ? "receipt-is-loading" : ""}`}>
          {false ? (<>
          <Link href="/#my-ticket">
            <span>YOUR RECEIPT</span>
            <strong>VIEW FULL TICKET</strong>
          </Link>
          <a href="#slate-matchups">
            <span>PICK&apos;EM</span>
            <strong className={receiptIsLoading ? "is-quiet" : pickemHasUnsavedChanges ? "is-unsaved" : selectedPicks.length === selectionLimit ? "is-complete" : "is-due"}>
              <span className="slate-receipt-picks-full">{receiptIsLoading ? "CHECKING" : pickemReceipt}</span>
              <span className="slate-receipt-picks-short">{receiptIsLoading ? "CHECKING" : pickemReceiptShort}</span>
            </strong>
            <em>{selectedPicks.length}/{selectionLimit} SELECTED · {pickemHasUnsavedChanges ? "UNSAVED CHANGE" : selectedPicks.length === selectionLimit ? "SAVED" : "PICK DUE"}</em>
          </a>
          {week?.period_type === "playoff" ? (
            <a href="#slate-matchups">
              <span>PLAYOFF ROUND</span>
              <strong className={receiptIsLoading ? "is-quiet" : pickemHasUnsavedChanges ? "is-unsaved" : selectedPicks.length === selectionLimit ? "is-complete" : "is-due"}>{receiptIsLoading ? "CHECKING" : `${selectedPicks.length}/${selectionLimit} GAMES`}</strong>
              <em>{pickemHasUnsavedChanges ? "UNSAVED CHANGE" : selectedPicks.length === selectionLimit ? "ROUND FILLED" : "GAMES DUE"}</em>
            </a>
          ) : (
            <a href="#slate-matchups">
              <span>SURVIVOR</span>
              <strong className={receiptIsLoading ? "is-quiet" : survivorHasUnsavedChanges ? "is-unsaved" : survivorReceipt === "OPEN" ? "is-due" : survivorReceipt === "OUT" ? "is-out" : survivorReceipt === "COMPLETE" ? "is-quiet" : "is-complete"}>
                <span className="slate-receipt-picks-full">{receiptIsLoading ? "CHECKING" : survivorReceipt}</span>
                <span className="slate-receipt-picks-short">{receiptIsLoading ? "CHECKING" : survivorReceiptShort}</span>
              </strong>
              <em>{survivorHasUnsavedChanges ? "UNSAVED CHANGE" : survivorReceipt === "OPEN" ? "PICK DUE" : survivorReceipt === "OUT" || survivorReceipt === "COMPLETE" ? "" : "SAVED"}</em>
            </a>
          )}
          </>) : null}
          <div className="slate-receipt-ticket">
          <span>YOUR RECEIPT</span>
            <Link href="/#my-ticket">VIEW FULL TICKET</Link>
            <button
              aria-hidden={!receiptNeedsSaving}
              className={`slate-receipt-print ${receiptNeedsSaving ? "" : "is-placeholder"}`}
              disabled={!receiptNeedsSaving || isSubmitting}
              onClick={submitPicks}
              tabIndex={receiptNeedsSaving ? undefined : -1}
              type="button"
            >
              <span aria-hidden="true" className="slate-receipt-print-trace">
                <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <path className="slate-receipt-print-trace-path" d="M 2 2 H 98 V 38 H 2 V 2" pathLength="100" />
                </svg>
              </span>
                {isSubmitting ? "SAVING…" : receiptIsReprint ? "REPRINT TICKET" : "PRINT TICKET"}
            </button>
            <i aria-hidden="true" className="slate-receipt-bottom-perf" />
          </div>
          <div className="slate-receipt-pool">
            <span>PICK&apos;EM</span>
            <div className={`slate-receipt-selection-chips slate-receipt-selection-chips--${week?.period_type === "playoff" ? "playoff" : "regular"}`} style={{ "--selection-slot-count": selectionLimit } as CSSProperties}>
              {receiptIsLoading ? <strong className="is-quiet">CHECKING</strong> : selectedTeams.length ? selectedTeams.map((team, index) => (
                <span className={`selection-chip slate-receipt-selection-chip ${team.isSaved ? "is-saved" : "is-draft"}`} key={team.gameId}>
                  <span>{index + 1}. {team.abbreviation}{team.lineValue ? <small className={team.isLineLocked ? "is-official" : ""}> {team.lineValue}</small> : null}</span>
                  {team.canRemove ? <button aria-label={`Remove ${team.name}`} onClick={() => removeSelection(team.gameId)} type="button">×</button> : null}
                </span>
              )) : <strong className="is-due">PICK DUE</strong>}
            </div>
            <em className={pickemReceiptStatus === "CHANGED" ? "is-unsaved" : pickemReceiptStatus === "FILLED" ? "is-complete" : ""}>{receiptIsLoading ? "CHECKING" : `${selectedPicks.length}/${selectionLimit} · ${pickemReceiptStatus}`}</em>
            <i aria-hidden="true" className="slate-receipt-bottom-perf" />
          </div>
          {week?.period_type === "playoff" ? (
            <div className="slate-receipt-pool">
              <span>PLAYOFF ROUND</span>
              <strong className={pickemReceiptStatus === "CHANGED" ? "is-unsaved" : pickemReceiptStatus === "FILLED" ? "is-complete" : "is-due"}>{receiptIsLoading ? "CHECKING" : `${selectedPicks.length}/${selectionLimit} GAMES`}</strong>
              <em>{pickemReceiptStatus === "CHANGED" ? "UNSAVED CHANGE" : pickemReceiptStatus === "FILLED" ? "ROUND FILLED" : "GAMES DUE"}</em>
              <i aria-hidden="true" className="slate-receipt-bottom-perf" />
            </div>
          ) : (
            <div className="slate-receipt-pool slate-receipt-survivor">
              <span>SURVIVOR</span>
              <div className={`slate-receipt-survivor-pick ${survivorHasUnsavedChanges && survivorControlsEnabled ? "is-awaiting-lock" : ""}`}>
                {!receiptIsLoading && survivorPickDetails ? <><SurvivorPokerChip abbreviation={survivorPickDetails.abbreviation} idleSpin={survivorControlsEnabled} size="summary" teamName={survivorPickDetails.name} /><strong>{survivorPickDetails.name}</strong></> : <strong className={survivorReceiptStatus === "OPEN" ? "is-due" : survivorReceiptStatus === "OUT" ? "is-out" : "is-quiet"}>{receiptIsLoading ? "CHECKING" : survivorReceipt}</strong>}
              </div>
              <em className={survivorReceiptStatus === "CHANGED" ? "is-unsaved" : survivorReceiptStatus === "FILLED" ? "is-complete" : ""}>{receiptIsLoading ? "CHECKING" : survivorReceiptStatus}</em>
              <i aria-hidden="true" className="slate-receipt-bottom-perf" />
            </div>
          )}
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
                        survivor={survivorControlsEnabled ? {
                          enabled: true,
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

      {false ? (
        <aside className="slate-selection-footer fixed inset-x-0 bottom-0 z-[60] border-t-2 border-[#1d1d1f] bg-[#f5f0e6] shadow-[0_-8px_24px_rgba(0,0,0,0.1)]">
          <div className="slate-selection-footer-inner mx-auto max-w-5xl px-4 py-3 sm:px-5 sm:py-4 md:px-10">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="slate-selection-footer-heading">
                <p className="text-[11px] font-black tracking-[0.14em] text-slate-600">
                  YOUR PICKS · {selectedPicks.length} OF {selectionLimit}
                </p>
                <p className={`slate-selection-footer-state ${hasUnsavedChanges ? "is-unsaved" : "is-saved"}`}>
                  {hasUnsavedChanges ? "UNSAVED CHANGES" : "SAVED"}
                </p>
                </div>

                <ol
                  className={`slate-selection-footer-picks ${week?.period_type === "playoff" ? "slate-selection-footer-picks--playoff" : "slate-selection-footer-picks--regular"} mt-1 flex flex-wrap gap-1.5 text-xs text-slate-700 sm:mt-2 sm:gap-2 sm:text-sm`}
                  style={{ "--selection-slot-count": selectionLimit } as CSSProperties}
                >
                  {selectedTeams.length ? (
                    selectedTeams.map((team, index) => (
                      <li className={`selection-chip slate-selection-chip ${team.isSaved ? "is-saved" : "is-draft"} flex items-center gap-1 border border-slate-400 bg-white py-1 pl-2 pr-1`} key={team.gameId}>
                        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" aria-label={`${index + 1}. ${team.name}${team.lineValue ? `, ${team.lineValue}` : ""}`} title={team.name}>{index + 1}. {team.abbreviation}{team.lineValue ? <small className={team.isLineLocked ? "is-official" : ""}> {team.lineValue}</small> : null}</span>
                        <small>{team.isSaved ? "SAVED" : "NEW"}</small>
                        {team.canRemove ? (
                          <button
                            aria-label={`Remove ${team.name}`}
                            className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-lg font-black leading-none text-slate-600 shadow-sm transition hover:border-red-400 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-800"
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

                {week?.period_type === "regular" && survivorAvailable ? (
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-700 sm:text-sm">
                    <span className="font-black tracking-[0.12em] text-slate-600">SURVIVOR</span>
                    {survivorPickDetails ? (
                      <>
                        <SurvivorPokerChip
                          abbreviation={survivorPickDetails?.abbreviation ?? ""}
                          official={survivorPick?.teamId === savedSurvivorPick?.teamId}
                          selected
                          size="summary"
                          teamName={survivorPickDetails?.name ?? ""}
                        />
                        <span className="font-semibold">{survivorPickDetails?.name}</span>
                      </>
                    ) : (
                      <span>{savedSurvivorPick ? "Survivor pick cleared" : "Survivor pick due"}</span>
                    )}
                  </div>
                ) : null}

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

                {hasUnsavedChanges ? <button
                  className="min-h-11 bg-[#1d1d1f] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-h-12 sm:px-6 sm:text-base"
                  disabled={isSubmitting}
                  onClick={submitPicks}
                  type="button"
                >
                {isSubmitting
                  ? "Saving…"
                  : "Save selections"}
                </button> : null}
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
