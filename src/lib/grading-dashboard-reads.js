/** @typedef {{ id: string }} GradingGameReference */

/**
 * Read selected-period game rows once and reuse their IDs for locked lines.
 * Normalize the thenable immediately so the route and dependent line read
 * await the same database request, while unrelated dashboard reads proceed.
 *
 * @template {{ data: GradingGameReference[] | null, error: unknown }} Games
 * @template Lines
 * @param {() => PromiseLike<Games>} readGames
 * @param {(gameIds: string[]) => PromiseLike<Lines>} readLines
 * @returns {{ games: Promise<Games>, lines: Promise<Lines> }}
 */
export function readGradingGamesAndLines(readGames, readLines) {
  const games = Promise.resolve(readGames());
  const lines = games.then(({ data }) => readLines((data ?? []).map((game) => game.id)));
  return { games, lines };
}
