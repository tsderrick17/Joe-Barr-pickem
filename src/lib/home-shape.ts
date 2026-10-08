import { comparePickColumns } from "@/lib/pick-column-order.js";
import { shouldRevealPick } from "@/lib/pick-visibility";
import { countPickemWins } from "@/lib/standings";

// The Pick'em Pad's rows, shaped from rows the route has already read. Nothing here touches
// the database: it is where a pick is shown to, or kept from, each viewer (a player's own
// pick is always visible to them; everyone else's only once the game has kicked off).

export type PadPickRow = { player_id: string; game_id: string; selected_team_id: string; scoring_period_id: string; submitted_at: string; result: string };
export type PadGameRow = { id: string; kickoff_at: string };
export type PadPreliminaryLine = { game_id: string; favorite_team_id: string | null; spread: number | string; captured_at: string };
export type PadLockedLine = { game_id: string; favorite_team_id: string | null; locked_spread: number | string };

export function signedSpread(selectedTeamId: string, favoriteTeamId: string | null, spread: number | string) {
  const value = Number(spread);
  if (!Number.isFinite(value)) return null;
  if (value === 0) return "PK";
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return selectedTeamId === favoriteTeamId ? `-${displayValue}` : `+${displayValue}`;
}

/** One row per player: season wins, trophies, and the current week's picks in kickoff order, sorted by wins then name. */
export function shapePadRows({
  players,
  allPicks,
  currentWeekPicks,
  gameById,
  teamById,
  lockedLineByGameId,
  preliminaryLineByGameId,
  trophiesByPlayerId,
  playoffEliminatedPlayerIds,
  viewerPlayerId,
  now,
}: {
  players: Array<{ id: string; first_name: string }>;
  /** Every winning pick of the season (player and result only): the season totals count these. */
  allPicks: Array<Pick<PadPickRow, "player_id" | "result">>;
  currentWeekPicks: PadPickRow[];
  gameById: Map<string, PadGameRow>;
  teamById: Map<string, { name: string; abbreviation: string }>;
  lockedLineByGameId: Map<string, PadLockedLine>;
  preliminaryLineByGameId: Map<string, PadPreliminaryLine>;
  trophiesByPlayerId: Map<string, string[]>;
  playoffEliminatedPlayerIds: Set<string>;
  viewerPlayerId: string;
  now: Date;
}) {
  return players
    .map((player) => {
      const wins = countPickemWins(allPicks.filter((pick) => pick.player_id === player.id));

      // A pick keeps its column: kickoff order, not submission order.
      const weeklyPicks = currentWeekPicks
        .filter((pick) => pick.player_id === player.id)
        .sort((first, second) => comparePickColumns(
          { gameId: first.game_id, kickoffAt: gameById.get(first.game_id)?.kickoff_at },
          { gameId: second.game_id, kickoffAt: gameById.get(second.game_id)?.kickoff_at },
        ))
        .map((pick) => {
          const game = gameById.get(pick.game_id);

          const visible = shouldRevealPick({ viewerPlayerId, pickPlayerId: player.id, kickoffAt: game?.kickoff_at }, now);

          let resultMark = "";
          if (pick.result === "win") resultMark = "W";
          if (pick.result === "loss") resultMark = "L";

          const lockedLine = lockedLineByGameId.get(pick.game_id);
          const preliminaryLine = preliminaryLineByGameId.get(pick.game_id);
          const line = lockedLine ?? preliminaryLine;

          const team = teamById.get(pick.selected_team_id);
          return {
            label: visible ? team?.name ?? "Unknown team" : null,
            abbreviation: visible ? team?.abbreviation ?? null : null,
            kickoffAt: game?.kickoff_at,
            isHidden: !visible,
            resultMark: visible ? resultMark : "",
            spread: visible && line ? signedSpread(pick.selected_team_id, line.favorite_team_id, lockedLine ? lockedLine.locked_spread : preliminaryLine!.spread) : null,
            isLineLocked: Boolean(lockedLine),
          };
        });

      return {
        id: player.id,
        firstName: player.first_name,
        trophies: trophiesByPlayerId.get(player.id) ?? [],
        wins,
        playoffEliminated: playoffEliminatedPlayerIds.has(player.id),
        picks: weeklyPicks,
      };
    })
    .sort((first, second) => second.wins - first.wins || first.firstName.localeCompare(second.firstName));
}
