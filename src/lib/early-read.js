// @ts-check

/**
 * The Standings' and the Slate's first data read, started before the page's JavaScript has arrived.
 *
 * On a slow phone the page's code takes seconds to download and start, and only then did the page ask for its data.
 * EARLY_READ_SCRIPT runs inline in <head>: on `/` and `/board` it reads the signed-in session the Supabase client keeps
 * in localStorage and starts that page's first read at once, with exactly the request the page itself would make. When
 * the page then asks for the same URL, fetchWithSession takes the answer already on its way instead of asking again,
 * so the server sees one request either way. Anything unusual (no session, a session about to expire, a different URL,
 * an answer that is not OK, one more than 15 seconds old) falls back to the page's own request. On the Standings it also
 * starts the Bowl Card's read when this device showed the card last time, the same rule as bowl-prefetch.ts.
 */
const GLOBAL = "__pickemEarlyReads";
const MAX_AGE_MS = 15_000;

/** @param {string} storageKey where the Supabase client keeps the session (sb-<project>-auth-token) */
export function earlyReadScript(storageKey) {
  return `try{var p=location.pathname,u=[];if(p==="/"){u.push("/api/home");if(localStorage.getItem("pickem-bowl-card-shown")==="1")u.push("/api/bowl-pool")}else if(p==="/board"){var q=new URLSearchParams({bootstrap:"1"}),w=new URLSearchParams(location.search).get("week");if(w)q.set("week",w);u.push("/api/board?"+q)}if(u.length){var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||"null");if(s&&s.access_token&&s.expires_at*1000-Date.now()>60000){var h={Authorization:"Bearer "+s.access_token};if(navigator.standalone===true||(window.matchMedia&&matchMedia("(display-mode: standalone)").matches))h["X-Pickem-App"]="1";var r={};for(var i=0;i<u.length;i++)r[u[i]]={at:Date.now(),response:fetch(u[i],{headers:h})};window.${GLOBAL}=r}}}catch(e){}`;
}

/**
 * Wait for an early answer, but stop when the page gives up on its request (its signal aborts, as on the Slate's
 * 15-second limit): the page then sees the same AbortError its own request would have given, and tries again itself.
 * @param {Promise<Response>} response
 * @param {AbortSignal | null | undefined} signal
 * @returns {Promise<Response>}
 */
export function untilAborted(response, signal) {
  if (!signal) return response;
  const abortError = () => signal.reason ?? new DOMException("The request was cancelled.", "AbortError");
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    response.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
  });
}

/** The session's localStorage key for a Supabase project URL, the way the Supabase client names it. @param {string} supabaseUrl */
export function sessionStorageKey(supabaseUrl) {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

/**
 * The early answer for this request, if one was started for exactly this URL and is fresh; it can be taken once.
 * @param {RequestInfo | URL} input
 * @param {RequestInit} init
 * @param {{ [GLOBAL]?: Record<string, { at: number, response: Promise<Response> }>, location: { origin: string } } | undefined} scope
 * @param {number} now
 * @returns {Promise<Response> | null}
 */
export function takeEarlyRead(input, init, scope = typeof window === "undefined" ? undefined : /** @type {any} */ (window), now = Date.now()) {
  const reads = scope?.[GLOBAL];
  if (!reads || (init.method ?? "GET").toUpperCase() !== "GET" || init.body) return null;
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, scope.location.origin);
  if (url.origin !== scope.location.origin) return null;
  const key = url.pathname + url.search;
  const read = reads[key];
  if (!read) return null;
  delete reads[key];
  return now - read.at <= MAX_AGE_MS ? read.response : null;
}
