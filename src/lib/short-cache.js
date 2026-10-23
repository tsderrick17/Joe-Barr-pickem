/**
 * A tiny in-memory cache for one expensive read that many requests share. A value is reused for `ttlMs`; requests that arrive while it is being
 * built wait for that one build instead of starting their own; a failed build is never kept, so the next request tries again. Each server
 * instance keeps its own copy, so a value can be at most `ttlMs` out of date.
 * @template T
 * @param {number} ttlMs
 * @param {() => Promise<T>} build
 * @param {() => number} [now]
 */
export function createShortCache(ttlMs, build, now = Date.now) {
  /** @type {{ at: number, value: T } | null} */
  let kept = null;
  /** @type {Promise<T> | null} */
  let building = null;
  return async function read() {
    if (kept && now() - kept.at < ttlMs) return kept.value;
    if (!building) {
      building = build()
        .then((value) => { kept = { at: now(), value }; return value; })
        .finally(() => { building = null; });
    }
    return building;
  };
}
