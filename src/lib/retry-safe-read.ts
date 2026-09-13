type ResultWithError = { error?: { status?: number | string; code?: string; message?: string } | null };

const RETRY_DELAYS_MS = [120, 360] as const;

function isTransient(error: ResultWithError["error"]) {
  if (!error) return false;
  const status = Number(error.status);
  if (Number.isFinite(status) && (status === 0 || status >= 500)) return true;
  return /network|fetch|timeout|connection|temporar|unavailable/i.test(
    `${error.code ?? ""} ${error.message ?? ""}`,
  );
}

/**
 * Retries only idempotent reads and assertions. Never use this around a
 * submission mutation: an uncertain write must be shown to the player, not
 * replayed behind their back.
 */
export async function retrySafeRead<T extends ResultWithError>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  let result = await operation();
  for (const delay of RETRY_DELAYS_MS) {
    if (!isTransient(result.error)) return result;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    result = await operation();
  }
  return result;
}
