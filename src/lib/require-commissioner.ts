import type { NextRequest } from "next/server";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";

/**
 * The Commissioner check, on the shared authentication result: a missing or expired session is 401, an inactive
 * player or an ordinary player is 403, and a sign-in or database outage is 503, so a brief outage is never shown
 * to the Commissioner as "access required". The result is an object, never null: test `.ok`, do not test the
 * value itself (the old name, `requireCommissioner`, returned a player or null and was retired so a leftover
 * `if (!(await ...))` could not silently skip the check).
 */
export function commissionerAccess(request: NextRequest) {
  return authenticateActivePlayer(request, { profile: "named", requireCommissioner: true });
}
