/**
 * Asking an outside service with a second and third try. A request that never got an answer (a dropped connection, a timeout) is tried
 * again a few seconds apart, so one blip does not open an incident and page the Commissioner; an answer of any kind, even a refusal, is
 * returned at once and judged by the caller.
 */

/** How a request that never got an answer failed, in words: it timed out, or the network refused it (with the system's own code). */
export function unreachableReason(error) {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "it timed out after 10 seconds";
  const code = error instanceof Error ? error.cause?.code : undefined;
  return code ? `the connection failed (${code})` : "the connection failed";
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{ attempts?: number, waits?: number[], timeoutMs?: number, wait?: (ms: number) => Promise<unknown>, request?: typeof fetch }} [options]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetries(url, init = {}, { attempts = 3, waits = [2_000, 5_000], timeoutMs = 10_000, wait = (ms) => new Promise((done) => setTimeout(done, ms)), request = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await wait(waits[Math.min(attempt - 1, waits.length - 1)]);
    try {
      return await request(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
