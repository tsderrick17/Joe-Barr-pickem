/** @typedef {{ externalGameId: string, awayScore: number | null, homeScore: number | null }} StoredFinal */
/** @typedef {{ id: string, completed?: boolean, awayScore: number | null, homeScore: number | null }} ProviderFinal */
/** @typedef {{ storedFinals: StoredFinal[], providerEvents: ProviderFinal[] }} ReconciliationInput */

/**
 * Compare saved finals with provider finals without changing the saved result.
 *
 * @param {ReconciliationInput} input
 */
export function reconcileFinalScores({ storedFinals, providerEvents }) {
  const providerByExternalId = new Map(providerEvents.map((event) => [event.id, event]));

  return storedFinals.map((game) => {
    const event = providerByExternalId.get(game.externalGameId);
    if (!event) return { ...game, state: "not_reported" };
    if (!event.completed || event.awayScore === null || event.homeScore === null) {
      return { ...game, state: "provider_not_final" };
    }
    return {
      ...game,
      providerAwayScore: event.awayScore,
      providerHomeScore: event.homeScore,
      state: event.awayScore === game.awayScore && event.homeScore === game.homeScore ? "match" : "mismatch",
    };
  });
}
