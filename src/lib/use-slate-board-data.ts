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
import type {
  SlateGame as BoardGame,
  SlateResponse as BoardResponse,
  SlateScoringPeriod as ScoringPeriod,
} from "@/lib/api-contracts";

const BOARD_LOAD_TIMEOUT_MS = 15_000;

/**
 * Owns the Slate's server-loaded board, selected scoring period, and clock.
 * The callback is for player-specific state only; kickoff visibility refreshes
 * deliberately do not call it so a background read cannot replace a draft.
 */
export function useSlateBoardData(onBoardLoaded: (data: BoardResponse) => void) {
  const [weeks, setWeeks] = useState<ScoringPeriod[]>([]);
  const [week, setWeek] = useState<ScoringPeriod | null>(null);
  const [nextWeekAvailableAt, setNextWeekAvailableAt] = useState<number | null>(null);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [clockSynchronized, setClockSynchronized] = useState(false);
  const [playoffEliminated, setPlayoffEliminated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const activeBoardRequest = useRef<AbortController | null>(null);
  const boardRequestId = useRef(0);
  const serverClockOffset = useRef(0);
  const kickoffVisibilityRefreshedGameIds = useRef(new Set<string>());

  async function loadWeek(period: ScoringPeriod): Promise<boolean> {
    const requestId = boardRequestId.current + 1;
    boardRequestId.current = requestId;
    activeBoardRequest.current?.abort();

    const request = new AbortController();
    activeBoardRequest.current = request;
    const requestTimer = window.setTimeout(() => request.abort(), BOARD_LOAD_TIMEOUT_MS);

    setIsLoading(true);
    setErrorMessage("");
    setPlayoffEliminated(false);
    setClockSynchronized(false);
    kickoffVisibilityRefreshedGameIds.current.clear();
    setWeek(period);

    try {
      const response = await fetchWithSession(
        `/api/board?scoringPeriodId=${period.id}`,
        { signal: request.signal },
      );
      const data = (await response.json()) as BoardResponse;

      if (requestId !== boardRequestId.current) return false;

      if (!response.ok) {
        setErrorMessage(data.error ?? "The Slate could not be loaded.");
        return false;
      }

      const serverTime = Date.parse(data.serverTime);
      if (!Number.isFinite(serverTime)) {
        setErrorMessage("The Slate clock could not be verified safely.");
        return false;
      }

      serverClockOffset.current = serverTime - Date.now();
      setCurrentTime(serverTime);
      kickoffVisibilityRefreshedGameIds.current = new Set(
        data.games
          .filter((game) => Date.parse(game.kickoffAt) <= serverTime)
          .map((game) => game.id),
      );

      setGames(data.games);
      setPlayoffEliminated(data.pickem.playoffEliminated);
      onBoardLoaded(data);
      setClockSynchronized(true);
      return true;
    } catch (error) {
      if (requestId === boardRequestId.current) {
        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return false;
        }

        setErrorMessage("The Slate is taking too long to load. Please try again.");
      }
      return false;
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
    const request = new AbortController();
    const requestTimer = window.setTimeout(() => request.abort(), BOARD_LOAD_TIMEOUT_MS);

    async function loadBoard() {
      const requestedWeekId = new URLSearchParams(window.location.search).get("week");
      const params = new URLSearchParams({ bootstrap: "1" });
      if (requestedWeekId) params.set("week", requestedWeekId);

      try {
        const response = await fetchWithSession(`/api/board?${params}`, { signal: request.signal });
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
        setGames(data.games);
        setPlayoffEliminated(data.pickem.playoffEliminated);
        onBoardLoaded(data);
        setClockSynchronized(true);
      } catch (error) {
        if (disposed) return;
        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return;
        }
        setErrorMessage("The Slate is taking too long to load. Please try again.");
      } finally {
        window.clearTimeout(requestTimer);
        if (!disposed) setIsLoading(false);
      }
    }

    void loadBoard();

    return () => {
      disposed = true;
      window.clearTimeout(requestTimer);
      request.abort();
    };
  }, [onBoardLoaded]);

  useEffect(() => {
    const refreshTime = window.setInterval(
      () => setCurrentTime(Date.now() + serverClockOffset.current),
      60_000,
    );
    return () => window.clearInterval(refreshTime);
  }, []);

  useEffect(() => () => {
    boardRequestId.current += 1;
    activeBoardRequest.current?.abort();
    activeBoardRequest.current = null;
  }, []);

  useEffect(() => {
    if (!week || isLoading || !clockSynchronized || games.length === 0) return;

    const requestId = boardRequestId.current;
    const dueGameIds = games
      .filter((game) => new Date(game.kickoffAt).getTime() <= currentTime && !kickoffVisibilityRefreshedGameIds.current.has(game.id))
      .map((game) => game.id);
    const visibilityRequest = new AbortController();

    const refreshPublicVisibility = async (gameIds: string[]) => {
      gameIds.forEach((gameId) => kickoffVisibilityRefreshedGameIds.current.add(gameId));

      try {
        const response = await fetchWithSession(`/api/board?scoringPeriodId=${week.id}`, {
          signal: visibilityRequest.signal,
        });
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
        // Retry on the next minute tick without rehydrating player drafts.
        gameIds.forEach((gameId) => kickoffVisibilityRefreshedGameIds.current.delete(gameId));
      }
    };

    if (dueGameIds.length) {
      void refreshPublicVisibility(dueGameIds);
      return () => visibilityRequest.abort();
    }

    const nextKickoff = games
      .map((game) => new Date(game.kickoffAt).getTime())
      .filter((kickoffAt) => kickoffAt > currentTime)
      .sort((left, right) => left - right)[0];
    if (!nextKickoff) return;

    const timer = window.setTimeout(
      () => void refreshPublicVisibility(games.filter((game) => new Date(game.kickoffAt).getTime() === nextKickoff).map((game) => game.id)),
      Math.max(nextKickoff - currentTime, 0) + 500,
    );
    return () => {
      window.clearTimeout(timer);
      visibilityRequest.abort();
    };
  }, [clockSynchronized, currentTime, games, isLoading, week]);

  const availableWeeks = useMemo<ScoringPeriod[]>(() => {
    return selectAvailableScoringPeriods(weeks, {
      now: currentTime,
      nextWeekAvailableAt,
    }) as ScoringPeriod[];
  }, [currentTime, nextWeekAvailableAt, weeks]);

  return {
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
  };
}
