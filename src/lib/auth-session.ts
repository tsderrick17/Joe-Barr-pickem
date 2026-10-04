"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SESSION_REFRESH_WINDOW_MS = 60_000;
const TRANSIENT_READ_RETRY_DELAY_MS = 650;
const TRANSIENT_READ_STATUS_CODES = new Set([502, 503, 504]);
let inFlightSessionRead: Promise<Session | null> | null = null;

export class SessionUnavailableError extends Error {
  constructor(message = "Your sign-in session is unavailable.") {
    super(message);
    this.name = "SessionUnavailableError";
  }
}

function isReadRequest(init: RequestInit): boolean {
  return (init.method ?? "GET").toUpperCase() === "GET";
}

async function waitForTransientReadRetry(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Request was cancelled.", "AbortError");
  }

  await new Promise<void>((resolve, reject) => {
    const cancel = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(signal?.reason ?? new DOMException("Request was cancelled.", "AbortError"));
    };

    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, TRANSIENT_READ_RETRY_DELAY_MS);

    signal?.addEventListener("abort", cancel, { once: true });
  });
}

async function loadFreshSession(): Promise<Session | null> {
  // A browser navigation immediately after PIN sign-in can race Supabase's
  // local-session hydration. Read a few times before treating the player as
  // signed out; this prevents a valid, newly-created session from bouncing
  // between the Slate and the PIN page on a slow phone or connection.
  let session: Session | null = null;

  // Supabase restores a persisted browser session asynchronously. Give that
  // handoff a short, bounded window so a newly signed-in player is never
  // redirected just because the next route rendered a fraction too quickly.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await supabase.auth.getSession();
    session = result.data.session;
    // A just-created browser session may briefly report a storage/read-lock
    // error while the auth client finishes persisting it. Treat that exactly
    // like an empty read and retry within the bounded hydration window.
    if (session || attempt === 7) break;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  if (!session) return null;

  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() > SESSION_REFRESH_WINDOW_MS) {
    return session;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !refreshedSession) return null;
  return refreshedSession;
}

export async function getFreshSession(): Promise<Session | null> {
  // The navigation and the page commonly mount together. Share that one
  // local/session refresh instead of making both wait on duplicate auth work.
  // This is deliberately in-flight-only: sign-out and expiry are never cached.
  if (inFlightSessionRead) return inFlightSessionRead;
  inFlightSessionRead = loadFreshSession();
  try {
    return await inFlightSessionRead;
  } finally {
    inFlightSessionRead = null;
  }
}

// Identical plain reads share one request while it is in flight, so two parts
// of a page asking for the same data at once cost the server one request. The
// player's profile, which the page chrome (navigation, chat dock) and the page
// each ask for, is also kept for a few seconds; a successful save to the same
// path clears it at once.
const KEPT_READ_PATHS = new Set(["/api/profile"]);
const KEPT_READ_TTL_MS = 15_000;
const sharedReads = new Map<string, { startedAt: number; response: Promise<Response> }>();

function sharedReadKey(input: RequestInfo | URL, init: RequestInit): string | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (typeof window === "undefined") return null;
  const url = new URL(raw, window.location.origin);
  // Only a plain read is shared: never a save, and never a cancellable one.
  if (!isReadRequest(init) || init.signal || !url.pathname.startsWith("/api/")) return null;
  return url.pathname + url.search;
}

function forgetSharedReads(input: RequestInfo | URL) {
  if (typeof window === "undefined") return;
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(raw, window.location.origin).pathname;
  for (const key of sharedReads.keys()) if (key.startsWith(path)) sharedReads.delete(key);
}

export async function fetchWithSession(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const sharedKey = sharedReadKey(input, init);
  if (sharedKey) {
    const existing = sharedReads.get(sharedKey);
    if (existing) return (await existing.response).clone();
    const path = sharedKey.split("?")[0];
    const kept = KEPT_READ_PATHS.has(path) && init.cache !== "no-store";
    const response = fetchWithSessionOnce(input, init);
    sharedReads.set(sharedKey, { startedAt: Date.now(), response });
    const forget = () => { if (sharedReads.get(sharedKey)?.response === response) sharedReads.delete(sharedKey); };
    // Once settled, a read is forgotten at once, unless it is a kept path that succeeded.
    void response.then((result) => { if (!result.ok || !kept) forget(); else window.setTimeout(forget, KEPT_READ_TTL_MS); }, forget);
    return (await response).clone();
  }
  const result = await fetchWithSessionOnce(input, init);
  if (!isReadRequest(init) && result.ok) forgetSharedReads(input);
  return result;
}

async function fetchWithSessionOnce(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const session = await getFreshSession();
  if (!session) throw new SessionUnavailableError();

  const request = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };

  const retrySafeRead = isReadRequest(init);
  let response: Response;

  try {
    response = await request(session.access_token);
  } catch (error) {
    // This is intentionally limited to safe reads. A short retry makes a
    // temporary browser/network handoff recover without ever replaying a
    // selection, save, or commissioner action.
    if (!retrySafeRead || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }

    await waitForTransientReadRetry(init.signal ?? undefined);
    response = await request(session.access_token);
  }

  if (retrySafeRead && TRANSIENT_READ_STATUS_CODES.has(response.status)) {
    await waitForTransientReadRetry(init.signal ?? undefined);
    response = await request(session.access_token);
  }

  if (response.status !== 401) return response;

  const {
    data: { session: refreshedSession },
    error,
  } = await supabase.auth.refreshSession();

  if (error || !refreshedSession) {
    throw new SessionUnavailableError(
      "Your sign-in expired. Please enter your PIN again.",
    );
  }

  const retryResponse = await request(refreshedSession.access_token);
  if (retryResponse.status === 401) {
    throw new SessionUnavailableError(
      "Your sign-in could not be verified. Please enter your PIN again.",
    );
  }

  return retryResponse;
}

// Signing in or out must never leave one player's shared reads for the next.
if (typeof window !== "undefined") supabase.auth.onAuthStateChange(() => sharedReads.clear());
