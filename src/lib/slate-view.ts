import { shouldShowPoolActionMatchup } from "@/lib/pool-action-visibility";

// The Slate page's rules and derived views, with no React in them: what a click on a team
// does, which games show, and what the receipt lists. The page keeps the state and applies
// these results, so each rule can be tested on its own.

export type SlateGame = {
  id: string;
  kickoffAt: string;
  awayTeam: string;
  homeTeam: string;
  awayTeamAbbreviation: string;
  homeTeamAbbreviation: string;
  favoriteTeamId: string | null;
  awayTeamId: string;
  homeTeamId: string;
  officialSpread: number | null;
  preliminarySpread: number | null;
  spreadLockedAt: string | null;
  awayPickers: string[];
  homePickers: string[];
};

export type SlatePick = { gameId: string; teamId: string };

export const SEALED_MESSAGE = "That game has kicked off. Its submitted pick is sealed.";

const hasKickedOff = (game: SlateGame, now: number) => new Date(game.kickoffAt).getTime() <= now;

export function easternDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(new Date(value));
}

/** What choosing a team does to the Pick'em selection (the page applies it with the matching update). */
export type PickChoice =
  | { kind: "sealed"; warning: string }
  | { kind: "remove" }
  | { kind: "swap" }
  | { kind: "limit"; warning: string }
  | { kind: "add" };

export function decidePickChoice({ picks, games, gameId, teamId, now, limit }: { picks: SlatePick[]; games: SlateGame[]; gameId: string; teamId: string; now: number; limit: number }): PickChoice {
  const game = games.find((item) => item.id === gameId);
  if (!game || hasKickedOff(game, now)) return { kind: "sealed", warning: SEALED_MESSAGE };
  const existing = picks.find((pick) => pick.gameId === gameId);
  if (existing?.teamId === teamId) return { kind: "remove" };
  if (existing) return { kind: "swap" };
  if (picks.length >= limit) return { kind: "limit", warning: `You already have ${limit} selections. Click one again to remove it first.` };
  return { kind: "add" };
}

export const withoutGame = (picks: SlatePick[], gameId: string) => picks.filter((pick) => pick.gameId !== gameId);
export const withPick = (picks: SlatePick[], gameId: string, teamId: string) => [...withoutGame(picks, gameId), { gameId, teamId }];

/** What choosing a Survivor team does: nothing, a warning, or select it. */
export type SurvivorChoice = { kind: "ignore" } | { kind: "warn"; warning: string } | { kind: "select" };

export function decideSurvivorChoice({ games, gameId, teamId, now, current, saved, usedTeamIds }: { games: SlateGame[]; gameId: string; teamId: string; now: number; current: SlatePick | null; saved: SlatePick | null; usedTeamIds: string[] }): SurvivorChoice {
  const game = games.find((item) => item.id === gameId);
  if (!game || hasKickedOff(game, now)) return { kind: "ignore" };
  // During an unsaved replacement the originally saved team stays selectable too: the client can
  // hold an older used-team list until the next refresh, so this week's saved team is exempt.
  if (usedTeamIds.includes(teamId) && current?.teamId !== teamId && saved?.teamId !== teamId) return { kind: "warn", warning: "That team has already been used in Survivor." };
  return { kind: "select" };
}

/** Whether removing a pick from the receipt is allowed, and the message if not. */
export function decideRemoval({ games, gameId, now }: { games: SlateGame[]; gameId: string; now: number }): { allowed: true } | { allowed: false; warning: string } {
  const game = games.find((item) => item.id === gameId);
  return !game || hasKickedOff(game, now) ? { allowed: false, warning: SEALED_MESSAGE } : { allowed: true };
}

/** Games grouped by their Eastern calendar day, in the order the days first appear. */
export function groupGamesByDay<Game extends SlateGame>(games: Game[]) {
  const grouped = new Map<string, Game[]>();
  for (const game of games) {
    const day = easternDate(game.kickoffAt);
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)?.push(game);
  }
  return Array.from(grouped.entries());
}

/** The Pool Action view: only games with public selections or about to start; empty days drop out. */
export function filterPoolActionDays<Game extends SlateGame>(days: Array<[string, Game[]]>, now: number) {
  return days
    .map(([day, dayGames]) => [day, dayGames.filter((game) => shouldShowPoolActionMatchup({ kickoffAt: game.kickoffAt, now, hasSelections: game.awayPickers.length > 0 || game.homePickers.length > 0 }))] as const)
    .filter(([, dayGames]) => dayGames.length > 0);
}

export type SelectedTeamLine = { gameId: string; name: string; abbreviation: string; lineValue: string | null; isLineLocked: boolean; canRemove: boolean; isSaved: boolean };

/** The receipt's list of the player's selections, in game order. */
export function describeSelectedTeams({ picks, savedPicks, games, now }: { picks: SlatePick[]; savedPicks: SlatePick[]; games: SlateGame[]; now: number }): SelectedTeamLine[] {
  const gameOrder = new Map(games.map((game, index) => [game.id, index]));

  return [...picks]
    .sort((left, right) => (gameOrder.get(left.gameId) ?? Number.MAX_SAFE_INTEGER) - (gameOrder.get(right.gameId) ?? Number.MAX_SAFE_INTEGER))
    .map((pick) => {
      const game = games.find((item) => item.id === pick.gameId);

      if (!game) return null;
      const isHome = pick.teamId === game.homeTeamId;
      const isAway = pick.teamId === game.awayTeamId;
      const name = isHome ? game.homeTeam.toUpperCase() : isAway ? game.awayTeam : null;

      if (!name) return null;

      const canonicalAbbreviation = (isHome ? game.homeTeamAbbreviation : game.awayTeamAbbreviation).toUpperCase();
      // The compact receipt convention everywhere: home abbreviations uppercase, away lowercase.
      const abbreviation = isHome ? canonicalAbbreviation : canonicalAbbreviation.toLowerCase();
      const hasFinalLine = game.spreadLockedAt !== null && game.officialSpread !== null;
      const selectedTeamIsFavorite = pick.teamId === game.favoriteTeamId;
      const displayedSpread = hasFinalLine ? game.officialSpread : game.preliminarySpread;
      const lineValue = displayedSpread === null
        ? null
        : displayedSpread === 0
          ? "PK"
          : `${selectedTeamIsFavorite ? "-" : "+"}${Number.isInteger(displayedSpread) ? displayedSpread : displayedSpread.toFixed(1)}`;

      const isSaved = savedPicks.some((savedPick) => savedPick.gameId === pick.gameId && savedPick.teamId === pick.teamId);

      return { gameId: pick.gameId, name, abbreviation, lineValue, isLineLocked: hasFinalLine, canRemove: new Date(game.kickoffAt).getTime() > now, isSaved };
    })
    .filter(Boolean) as SelectedTeamLine[];
}

/** True when the chosen picks differ from the saved ones in any game or team. */
export function picksDiffer(selected: SlatePick[], saved: SlatePick[]) {
  if (selected.length !== saved.length) return true;
  return selected.some((pick) => !saved.some((savedPick) => savedPick.gameId === pick.gameId && savedPick.teamId === pick.teamId));
}
