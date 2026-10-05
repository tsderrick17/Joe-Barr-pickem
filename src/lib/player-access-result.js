/**
 * Resolve one request's player access without caching identity or permissions.
 * The injected reads keep auth failure behavior executable without a live pool.
 *
 * @template {{ active: boolean, is_commissioner: boolean }} T
 * @param {{ authorization: string | null, configured: boolean, verifyToken: (token: string) => Promise<{ data?: { user?: { id: string } | null }, error?: { status?: number | string } | null }>, loadPlayer: (userId: string) => Promise<{ data?: T | null, error?: unknown }>, requireCommissioner?: boolean }} options
 * @returns {Promise<{ ok: true, player: T } | { ok: false, status: 401 | 403 | 500 | 503, code: string }>}
 */
export async function resolvePlayerAccess({ authorization, configured, verifyToken, loadPlayer, requireCommissioner = false }) {
  if (!configured) return { ok: false, status: 500, code: "auth_not_configured" };
  const token = /^Bearer ([^\s]+)$/.exec(authorization ?? "")?.[1];
  if (!token) return { ok: false, status: 401, code: "session_invalid" };

  let verified;
  try {
    verified = await verifyToken(token);
  } catch {
    return { ok: false, status: 503, code: "auth_unavailable" };
  }
  if (verified.error) {
    const status = Number(verified.error.status);
    return status === 400 || status === 401 || status === 403
      ? { ok: false, status: 401, code: "session_invalid" }
      : { ok: false, status: 503, code: "auth_unavailable" };
  }
  if (!verified.data?.user?.id) return { ok: false, status: 401, code: "session_invalid" };

  let profile;
  try {
    profile = await loadPlayer(verified.data.user.id);
  } catch {
    return { ok: false, status: 503, code: "profile_unavailable" };
  }
  if (profile.error) return { ok: false, status: 503, code: "profile_unavailable" };
  if (!profile.data) return { ok: false, status: 403, code: "player_not_found" };
  if (!profile.data.active) return { ok: false, status: 403, code: "player_inactive" };
  if (requireCommissioner && !profile.data.is_commissioner) {
    return { ok: false, status: 403, code: "commissioner_required" };
  }
  return { ok: true, player: profile.data };
}
