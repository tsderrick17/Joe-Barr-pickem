// @ts-check
/** @typedef {{ status: 401 | 403 | 500 | 503, body: { error: string, code: string } }} BowlPoolAccessFailure */

/**
 * Keep Bowl Pool's viewer-facing auth errors consistent with the shared
 * request-scoped player access result.
 * @param {{ ok: false, status: 401 | 403 | 500 | 503, code: string }} access
 * @param {"view" | "save"} action
 * @returns {BowlPoolAccessFailure}
 */
export function bowlPoolAccessFailure(access, action) {
  const message = access.status === 503
    ? "The Bowl Pool service is temporarily unavailable. Please try again."
    : access.status === 500
      ? "The Bowl Pool service is not configured correctly. Please try again later."
      : access.status === 403
        ? "You must be signed in as an active player to use the Bowl Pool."
        : action === "save"
          ? "You must be signed in to save Bowl Pool selections."
          : "You must be signed in to view the Bowl Pool.";

  return {
    status: access.status,
    body: { error: message, code: access.code },
  };
}
