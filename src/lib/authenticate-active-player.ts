import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { resolvePlayerAccess } from "@/lib/player-access-result";

type ActivePlayerProfile = {
  id: string;
  active: boolean;
  is_commissioner: boolean;
  show_survivor_standings?: boolean;
  show_bowl_card?: boolean;
  show_pool_chat?: boolean;
  hide_pickem_eliminated_rows?: boolean;
  hide_survivor_eliminated_rows?: boolean;
};

type ActivePlayerOptions = {
  requireCommissioner?: boolean;
  includeStandingsPreferences?: boolean;
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

/** A request-scoped authentication result; no authorization state is cached. */
export function authenticateActivePlayer(
  request: NextRequest,
  options: ActivePlayerOptions & { includeStandingsPreferences: true },
): Promise<AccessResult<ActivePlayerProfile & StandingsPreferences>>;
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
      const columns = includeStandingsPreferences
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
