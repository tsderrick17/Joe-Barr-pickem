import { isReadRequest } from "./shared-read-cache.js";

const TRANSIENT_READ_STATUS_CODES = new Set([502, 503, 504]);

/**
 * The browser's request/retry boundary. Dependencies are request-scoped so
 * failure and uncertain-write behavior can be exercised without live auth.
 *
 * @param {{
 *   init: RequestInit,
 *   getSession: () => Promise<{ access_token: string } | null>,
 *   refreshSession: () => Promise<{ session: { access_token: string } | null, error: unknown }>,
 *   send: (token: string) => Promise<Response>,
 *   wait: () => Promise<void>,
 *   unavailable: (message?: string) => Error,
 * }} dependencies
 */
export async function executeAuthenticatedRequest({ init, getSession, refreshSession, send, wait, unavailable }) {
  const session = await getSession();
  if (!session) throw unavailable();

  const safeRead = isReadRequest(init);
  let response;
  try {
    response = await send(session.access_token);
  } catch (error) {
    // An uncertain mutation must never be replayed after a network failure.
    if (!safeRead || (error instanceof DOMException && error.name === "AbortError")) throw error;
    await wait();
    response = await send(session.access_token);
  }

  if (safeRead && TRANSIENT_READ_STATUS_CODES.has(response.status)) {
    await wait();
    response = await send(session.access_token);
  }
  if (response.status !== 401) return response;

  const { session: refreshedSession, error } = await refreshSession();
  if (error || !refreshedSession) {
    throw unavailable("Your sign-in expired. Please enter your PIN again.");
  }
  const retryResponse = await send(refreshedSession.access_token);
  if (retryResponse.status === 401) {
    throw unavailable("Your sign-in could not be verified. Please enter your PIN again.");
  }
  return retryResponse;
}
