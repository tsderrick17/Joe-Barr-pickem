import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { resolvePlayerAccess } from "@/lib/player-access-result";

type ActivePlayerProfile = {
  id: string;
  active: boolean;
  is_commissioner: boolean;
  first_name?: string;
  notification_email?: string | null;
  email_notifications_enabled?: boolean;
  email_weekly_enabled?: boolean;
  email_final_lines_enabled?: boolean;
  email_sunday_final_lines_enabled?: boolean;
  email_early_lock_enabled?: boolean;
  email_pick_due_enabled?: boolean;
  email_pick_due_sunday_early_enabled?: boolean;
  email_pick_due_sunday_afternoon_enabled?: boolean;
  email_pick_due_primetime_enabled?: boolean;
  email_weekly_recap_enabled?: boolean;
  email_playoff_day_recap_enabled?: boolean;
  email_playoff_public_reveal_enabled?: boolean;
  email_ats_due_enabled?: boolean;
  email_survivor_due_enabled?: boolean;
  email_sunday_early_reveal_enabled?: boolean;
  email_sunday_late_reveal_enabled?: boolean;
  email_featured_window_reveal_enabled?: boolean;
  email_custom_enabled?: boolean;
  show_pool_action?: boolean;
  show_survivor_standings?: boolean;
  show_bowl_card?: boolean;
  show_pool_chat?: boolean;
  hide_pickem_eliminated_rows?: boolean;
  hide_survivor_eliminated_rows?: boolean;
};

type ActivePlayerOptions = {
  requireCommissioner?: boolean;
  includeStandingsPreferences?: boolean;
  includeProfilePreferences?: boolean;
};

type AccessResult<T> =
  | { ok: true; player: T }
  | { ok: false; status: 401 | 403 | 500 | 503; code: string };

type StandingsPreferences = Required<Pick<ActivePlayerProfile,
  | "show_survivor_standings"
  | "show_bowl_card"
  | "show_pool_chat"
  | "hide_pickem_eliminated_rows"
  | "hide_survivor_eliminated_rows"
>>;

type ProfilePreferences = Required<Pick<ActivePlayerProfile,
  | "first_name"
  | "email_notifications_enabled"
  | "email_weekly_enabled"
  | "email_final_lines_enabled"
  | "email_sunday_final_lines_enabled"
  | "email_early_lock_enabled"
  | "email_pick_due_enabled"
  | "email_pick_due_sunday_early_enabled"
  | "email_pick_due_sunday_afternoon_enabled"
  | "email_pick_due_primetime_enabled"
  | "email_weekly_recap_enabled"
  | "email_playoff_day_recap_enabled"
  | "email_playoff_public_reveal_enabled"
  | "email_ats_due_enabled"
  | "email_survivor_due_enabled"
  | "email_sunday_early_reveal_enabled"
  | "email_sunday_late_reveal_enabled"
  | "email_featured_window_reveal_enabled"
  | "email_custom_enabled"
  | "show_pool_action"
>> & Pick<ActivePlayerProfile, "notification_email"> & StandingsPreferences;

/** A request-scoped authentication result; no authorization state is cached. */
export function authenticateActivePlayer(
  request: NextRequest,
  options: ActivePlayerOptions & { includeStandingsPreferences: true },
): Promise<AccessResult<ActivePlayerProfile & StandingsPreferences>>;
export function authenticateActivePlayer(
  request: NextRequest,
  options: ActivePlayerOptions & { includeProfilePreferences: true },
): Promise<AccessResult<ActivePlayerProfile & ProfilePreferences>>;
export function authenticateActivePlayer(
  request: NextRequest,
  options?: boolean | ActivePlayerOptions,
): Promise<AccessResult<ActivePlayerProfile>>;
export async function authenticateActivePlayer(
  request: NextRequest,
  options: boolean | ActivePlayerOptions = {},
) {
  const requireCommissioner = typeof options === "boolean"
    ? options
    : options.requireCommissioner ?? false;
  const includeStandingsPreferences = typeof options === "object"
    && options.includeStandingsPreferences === true;
  const includeProfilePreferences = typeof options === "object"
    && options.includeProfilePreferences === true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");

  return resolvePlayerAccess({
    authorization,
    configured: Boolean(url && publishableKey && serverKey),
    requireCommissioner,
    verifyToken: async (token) => {
      const client = createClient(url!, publishableKey!, {
        global: { headers: { Authorization: authorization! } },
      });
      return client.auth.getUser(token);
    },
    loadPlayer: async (userId) => {
      // Import only after configuration is checked so a missing server key
      // produces the explicit configuration result, not a module-load crash.
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      const columns = includeProfilePreferences
        ? "id, active, is_commissioner, first_name, notification_email, email_notifications_enabled, email_weekly_enabled, email_final_lines_enabled, email_sunday_final_lines_enabled, email_early_lock_enabled, email_pick_due_enabled, email_pick_due_sunday_early_enabled, email_pick_due_sunday_afternoon_enabled, email_pick_due_primetime_enabled, email_weekly_recap_enabled, email_playoff_day_recap_enabled, email_playoff_public_reveal_enabled, email_ats_due_enabled, email_survivor_due_enabled, email_sunday_early_reveal_enabled, email_sunday_late_reveal_enabled, email_featured_window_reveal_enabled, email_custom_enabled, show_survivor_standings, show_bowl_card, show_pool_action, show_pool_chat, hide_pickem_eliminated_rows, hide_survivor_eliminated_rows"
        : includeStandingsPreferences
          ? "id, active, is_commissioner, show_survivor_standings, show_bowl_card, show_pool_chat, hide_pickem_eliminated_rows, hide_survivor_eliminated_rows"
          : "id, active, is_commissioner";
      const { data, error } = await supabaseAdmin
        .from("players")
        .select(columns)
        .eq("auth_user_id", userId)
        .maybeSingle();
      return {
        data: data as ActivePlayerProfile | null,
        error,
      };
    },
  });
}
