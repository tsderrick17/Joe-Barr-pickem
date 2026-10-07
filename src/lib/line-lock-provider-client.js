const LINE_LOCK_PROVIDER_URL =
  "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/";
const PROVIDER_TIMEOUT_MS = 20_000;

/** @typedef {{ name: string; point?: number }} OddsOutcome */
/** @typedef {{ id: string; bookmakers?: Array<{ key: string; markets?: Array<{ key: string; outcomes?: OddsOutcome[] }> }> }} OddsEvent */
/**
 * @typedef {{
 *   events: OddsEvent[];
 *   providerAvailable: boolean;
 *   requestsRemaining: string | null;
 *   requestsUsed: string | null;
 *   requestsLast: string | null;
 *   warning: string | null;
 * }} LineLockProviderResult
 */

const unavailableWarning =
  "The live odds provider was unavailable. Last known lines were used where possible.";
const invalidWarning =
  "The live odds provider returned an unexpected response. Last known lines were used where possible.";
const unreachableWarning =
  "The live odds provider could not be reached. Last known lines were used where possible.";

/**
 * Fetch the live market once. Ordinary provider failures permit a fresh saved
 * fallback; lease cancellation must never be mistaken for such a failure.
 *
 * @param {string} apiKey
 * @param {typeof fetch} fetcher
 * @param {AbortSignal | undefined} executionSignal
 * @returns {Promise<LineLockProviderResult>}
 */
export async function fetchLineLockProviderEvents(
  apiKey,
  fetcher = fetch,
  executionSignal = undefined,
) {
  executionSignal?.throwIfAborted();
  const query = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "spreads",
    bookmakers: "draftkings",
    oddsFormat: "american",
  });
  const requestSignal = executionSignal
    ? AbortSignal.any([executionSignal, AbortSignal.timeout(PROVIDER_TIMEOUT_MS)])
    : AbortSignal.timeout(PROVIDER_TIMEOUT_MS);

  /** @type {Response} */
  let response;
  try {
    response = await fetcher(`${LINE_LOCK_PROVIDER_URL}?${query}`, {
      cache: "no-store",
      signal: requestSignal,
    });
  } catch {
    executionSignal?.throwIfAborted();
    return {
      events: [],
      providerAvailable: false,
      requestsRemaining: null,
      requestsUsed: null,
      requestsLast: null,
      warning: unreachableWarning,
    };
  }
  executionSignal?.throwIfAborted();
  const requestsRemaining = response.headers.get("x-requests-remaining");
  const requestsUsed = response.headers.get("x-requests-used");
  const requestsLast = response.headers.get("x-requests-last");
  /** @param {string} warning */
  const unavailable = (warning) => ({
    events: [],
    providerAvailable: false,
    requestsRemaining,
    requestsUsed,
    requestsLast,
    warning,
  });

  if (!response.ok) return unavailable(unavailableWarning);

  /** @type {unknown} */
  let payload;
  try {
    payload = await response.json();
  } catch {
    executionSignal?.throwIfAborted();
    return unavailable(unreachableWarning);
  }
  executionSignal?.throwIfAborted();
  if (!Array.isArray(payload)) return unavailable(invalidWarning);

  return {
    events: /** @type {OddsEvent[]} */ (payload),
    providerAvailable: true,
    requestsRemaining,
    requestsUsed,
    requestsLast,
    warning: null,
  };
}
