const KEPT_READ_PATHS = new Set(["/api/profile"]);
const KEPT_READ_TTL_MS = 15_000;

/** @param {RequestInit} init */
export function isReadRequest(init) {
  return (init.method ?? "GET").toUpperCase() === "GET";
}

/**
 * Keep only in-flight plain API reads, except for a short-lived successful
 * profile read. Session changes must call clear before another identity reads.
 *
 * @param {{ origin: () => string | null, schedule?: (callback: () => void, delay: number) => unknown }} dependencies
 */
export function createSharedReadCache({ origin, schedule = (callback, delay) => setTimeout(callback, delay) }) {
  /** @type {Map<string, Promise<Response>>} */
  const reads = new Map();

  /** @param {RequestInfo | URL} input */
  function requestUrl(input) {
    const base = origin();
    if (!base) return null;
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, base);
  }

  /** @param {RequestInfo | URL} input */
  function forgetPath(input) {
    const path = requestUrl(input)?.pathname;
    if (!path) return;
    for (const key of reads.keys()) if (key.startsWith(path)) reads.delete(key);
  }

  /**
   * @param {RequestInfo | URL} input
   * @param {RequestInit} init
   * @param {() => Promise<Response>} operation
   */
  async function run(input, init, operation) {
    const url = requestUrl(input);
    const key = url && isReadRequest(init) && !init.signal && url.pathname.startsWith("/api/")
      ? url.pathname + url.search
      : null;

    if (key) {
      const existing = reads.get(key);
      if (existing) return (await existing).clone();
      const kept = url !== null && KEPT_READ_PATHS.has(url.pathname) && init.cache !== "no-store";
      const response = operation();
      reads.set(key, response);
      const forget = () => { if (reads.get(key) === response) reads.delete(key); };
      void response.then((result) => {
        if (!result.ok || !kept) forget();
        else schedule(forget, KEPT_READ_TTL_MS);
      }, forget);
      return (await response).clone();
    }

    const result = await operation();
    if (!isReadRequest(init) && result.ok) forgetPath(input);
    return result;
  }

  return { run, clear: () => reads.clear() };
}
