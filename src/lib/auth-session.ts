"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SESSION_REFRESH_WINDOW_MS = 60_000;

export class SessionUnavailableError extends Error {
  constructor(message = "Your sign-in session is unavailable.") {
    super(message);
    this.name = "SessionUnavailableError";
  }
}

export async function getFreshSession(): Promise<Session | null> {
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

export async function fetchWithSession(
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

  const response = await request(session.access_token);
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
