import type { ProviderScoreEvent } from "@/lib/score-provider-matching";

const SCORE_PROVIDER_URL =
  "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores/";
const SCORE_PROVIDER_TIMEOUT_MS = 20_000;

type ScoreProviderFetcher = typeof fetch;

export class ScoreProviderClientError extends Error {
  readonly requestsRemaining: string | null;
  readonly requestsUsed: string | null;
  readonly requestsLast: string | null;

  constructor(
    message: string,
    requestsRemaining: string | null,
    requestsUsed: string | null,
    requestsLast: string | null,
  ) {
    super(message);
    this.name = "ScoreProviderClientError";
    this.requestsRemaining = requestsRemaining;
    this.requestsUsed = requestsUsed;
    this.requestsLast = requestsLast;
  }
}

/** Fetch and validate the transport-level score response; grading stays elsewhere. */
export async function fetchScoreProviderEvents(
  apiKey: string,
  fetcher: ScoreProviderFetcher = fetch,
  executionSignal?: AbortSignal,
): Promise<{
  events: ProviderScoreEvent[];
  requestsRemaining: string | null;
  requestsUsed: string | null;
  requestsLast: string | null;
}> {
  executionSignal?.throwIfAborted();
  const query = new URLSearchParams({ apiKey, daysFrom: "3" });
  const timeoutSignal = AbortSignal.timeout(SCORE_PROVIDER_TIMEOUT_MS);
  const response = await fetcher(`${SCORE_PROVIDER_URL}?${query}`, {
    cache: "no-store",
    signal: executionSignal
      ? AbortSignal.any([executionSignal, timeoutSignal])
      : timeoutSignal,
  });
  executionSignal?.throwIfAborted();
  const requestsRemaining = response.headers.get("x-requests-remaining");
  const requestsUsed = response.headers.get("x-requests-used");
  const requestsLast = response.headers.get("x-requests-last");

  if (!response.ok) {
    throw new ScoreProviderClientError(
      "The NFL score feed could not be reached right now.",
      requestsRemaining,
      requestsUsed,
      requestsLast,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    executionSignal?.throwIfAborted();
    throw new ScoreProviderClientError(
      "The NFL score feed returned an invalid response.",
      requestsRemaining,
      requestsUsed,
      requestsLast,
    );
  }
  executionSignal?.throwIfAborted();
  if (!Array.isArray(payload)) {
    throw new ScoreProviderClientError(
      "The NFL score feed returned an invalid response.",
      requestsRemaining,
      requestsUsed,
      requestsLast,
    );
  }

  return {
    events: payload as ProviderScoreEvent[],
    requestsRemaining,
    requestsUsed,
    requestsLast,
  };
}
