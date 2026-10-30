import { createClient } from "@supabase/supabase-js";
import { after, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { resolvePlayerAccess } from "@/lib/player-access-result";
import { retrySafeRead } from "@/lib/retry-safe-read";
import { countsAsActivity } from "@/lib/activity-rule.js";
import { activityDetails, recordPlayerActivity } from "@/lib/player-activity";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type BasicPlayer = Pick<PlayerRow, "id" | "active" | "is_commissioner">;
export type NamedPlayer = Pick<PlayerRow, "id" | "first_name" | "active" | "is_commissioner">;
type HomePlayer = BasicPlayer & Pick<PlayerRow, "show_survivor_standings" | "show_bowl_card" | "show_pool_chat" | "hide_pickem_eliminated_rows" | "hide_survivor_eliminated_rows">;
/** Everything the Notifications page and the display choices read and write. */
export type PreferencesPlayer = NamedPlayer & Pick<PlayerRow, "notification_email" | "email_notifications_enabled" | "email_weekly_enabled" | "email_final_lines_enabled" | "email_sunday_final_lines_enabled" | "email_early_lock_enabled" | "email_pick_due_enabled" | "email_pick_due_sunday_early_enabled" | "email_pick_due_sunday_afternoon_enabled" | "email_pick_due_primetime_enabled" | "email_weekly_recap_enabled" | "email_playoff_day_recap_enabled" | "email_playoff_public_reveal_enabled" | "email_ats_due_enabled" | "email_survivor_due_enabled" | "email_sunday_early_reveal_enabled" | "email_sunday_late_reveal_enabled" | "email_featured_window_reveal_enabled" | "email_custom_enabled" | "show_survivor_standings" | "show_bowl_card" | "show_pool_action" | "show_pool_chat" | "hide_pickem_eliminated_rows" | "hide_survivor_eliminated_rows">;

export type Access<T> =
  | { ok: true; player: T }
  | { ok: false; status: 401 | 403 | 500 | 503; code: string };

type Options = { requireCommissioner?: boolean };

// One sign-in checker per server instance, so the project's public signing keys (JWKS) are fetched once and kept for
// ten minutes. The project signs sessions with an asymmetric key (ES256), so a session token is verified locally
// (signature and expiry) instead of with a round trip to Supabase Auth on every request. The trade-off: a session that
// was signed out stays valid until its token expires (at most an hour); `players.active` is still read on every request,
// so a deactivated player is refused at once. A symmetric or unknown key falls back to asking Supabase Auth.
let tokenVerifier: ReturnType<typeof createClient> | null = null;
function sessionVerifier(url: string, publishableKey: string) {
  tokenVerifier ??= createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return tokenVerifier;
}

/**
 * One server authentication result for every protected route: a verified active player, or why not. 401 is a
 * missing or invalid session, 403 an inactive player or one without the needed role, 503 a sign-in or database
 * outage (never reported as lost access), 500 missing configuration. Request-scoped: no authorization state is
 * cached and nothing is retried except safe reads.
 */
export function authenticateActivePlayer(request: NextRequest, options: Options & { profile: "home" }): Promise<Access<HomePlayer>>;
export function authenticateActivePlayer(request: NextRequest, options: Options & { profile: "named" }): Promise<Access<NamedPlayer>>;
export function authenticateActivePlayer(request: NextRequest, options: Options & { profile: "preferences" }): Promise<Access<PreferencesPlayer>>;
export function authenticateActivePlayer(request: NextRequest, options?: Options & { profile?: "basic" }): Promise<Access<BasicPlayer>>;
export async function authenticateActivePlayer(
  request: NextRequest,
  options: Options & { profile?: "basic" | "home" | "named" | "preferences" } = {},
): Promise<Access<BasicPlayer | HomePlayer | NamedPlayer | PreferencesPlayer>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");

  const access = await resolvePlayerAccess({
    authorization,
    configured: Boolean(url && publishableKey && serverKey),
    requireCommissioner: options.requireCommissioner,
    verifyToken: async (token) => {
      const verified = await retrySafeRead(() => sessionVerifier(url!, publishableKey!).auth.getClaims(token));
      if (verified.error) return { error: verified.error };
      return { data: { user: verified.data?.claims.sub ? { id: verified.data.claims.sub } : null } };
    },
    loadPlayer: async (userId) => {
      // Import only after configuration is checked so a missing server key
      // produces the explicit configuration result, not a module-load crash.
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      const players = () => supabaseAdmin.from("players");
      if (options.profile === "home") return retrySafeRead(() => players()
        .select("id, active, is_commissioner, show_survivor_standings, show_bowl_card, show_pool_chat, hide_pickem_eliminated_rows, hide_survivor_eliminated_rows")
        .eq("auth_user_id", userId)
        .maybeSingle());
      if (options.profile === "named") return retrySafeRead(() => players()
        .select("id, first_name, active, is_commissioner")
        .eq("auth_user_id", userId)
        .maybeSingle());
      if (options.profile === "preferences") return retrySafeRead(() => players()
        .select("id, first_name, active, is_commissioner, notification_email, email_notifications_enabled, email_weekly_enabled, email_final_lines_enabled, email_sunday_final_lines_enabled, email_early_lock_enabled, email_pick_due_enabled, email_pick_due_sunday_early_enabled, email_pick_due_sunday_afternoon_enabled, email_pick_due_primetime_enabled, email_weekly_recap_enabled, email_playoff_day_recap_enabled, email_playoff_public_reveal_enabled, email_ats_due_enabled, email_survivor_due_enabled, email_sunday_early_reveal_enabled, email_sunday_late_reveal_enabled, email_featured_window_reveal_enabled, email_custom_enabled, show_survivor_standings, show_bowl_card, show_pool_action, show_pool_chat, hide_pickem_eliminated_rows, hide_survivor_eliminated_rows")
        .eq("auth_user_id", userId)
        .maybeSingle());
      return retrySafeRead(() => players()
        .select("id, active, is_commissioner")
        .eq("auth_user_id", userId)
        .maybeSingle());
    },
  });
  // Using any page counts as being active (the write is throttled to once per 15 minutes per player, and runs after the response).
  if (countsAsActivity(access, options)) {
    const playerId = (access as { ok: true; player: { id: string } }).player.id;
    const details = activityDetails(request);
    try { after(() => recordPlayerActivity(playerId, details)); } catch { void recordPlayerActivity(playerId, details); }
  }
  return access;
}
