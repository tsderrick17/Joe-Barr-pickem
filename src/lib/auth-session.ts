"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { executeAuthenticatedRequest } from "@/lib/authenticated-request";
import { createSharedReadCache } from "@/lib/shared-read-cache";

const SESSION_REFRESH_WINDOW_MS = 60_000;
const TRANSIENT_READ_RETRY_DELAY_MS = 650;
let inFlightSessionRead: Promise<Session | null> | null = null;

export class SessionUnavailableError extends Error {
  constructor(message = "Your sign-in session is unavailable.") {
    super(message);
    this.name = "SessionUnavailableError";
  }
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
const sharedReads = createSharedReadCache({ origin: () => typeof window === "undefined" ? null : window.location.origin });

export async function fetchWithSession(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return sharedReads.run(input, init, () => fetchWithSessionOnce(input, init));
}

async function fetchWithSessionOnce(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return executeAuthenticatedRequest({
    init,
    getSession: getFreshSession,
    refreshSession: async () => {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      return { session, error };
    },
    send: (accessToken) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${accessToken}`);
      return fetch(input, { ...init, headers });
    },
    wait: () => waitForTransientReadRetry(init.signal ?? undefined),
    unavailable: (message) => new SessionUnavailableError(message),
  });
}

// Signing in or out must never leave one player's shared reads for the next.
if (typeof window !== "undefined") supabase.auth.onAuthStateChange(() => sharedReads.clear());
