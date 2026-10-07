import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { resolvePlayerAccess } from "@/lib/player-access-result";
import { retrySafeRead } from "@/lib/retry-safe-read";

type BasicPlayer = { id: string; active: boolean; is_commissioner: boolean };
type HomePlayer = BasicPlayer & {
  show_survivor_standings: boolean;
  show_bowl_card: boolean;
  show_pool_chat: boolean;
  hide_pickem_eliminated_rows: boolean;
  hide_survivor_eliminated_rows: boolean;
};
type Access<T> =
  | { ok: true; player: T }
  | { ok: false; status: 401 | 403 | 500 | 503; code: string };

/** A request-scoped authentication result; no authorization state is cached. */
export function authenticateActivePlayer(request: NextRequest, options: { profile: "home"; requireCommissioner?: boolean }): Promise<Access<HomePlayer>>;
export function authenticateActivePlayer(request: NextRequest, options?: { profile?: "basic"; requireCommissioner?: boolean }): Promise<Access<BasicPlayer>>;
export async function authenticateActivePlayer(
  request: NextRequest,
  options: { requireCommissioner?: boolean; profile?: "basic" | "home" } = {},
): Promise<Access<BasicPlayer | HomePlayer>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");

  return resolvePlayerAccess({
    authorization,
    configured: Boolean(url && publishableKey && serverKey),
    requireCommissioner: options.requireCommissioner,
    verifyToken: async (token) => {
      const client = createClient(url!, publishableKey!, {
        global: { headers: { Authorization: authorization! } },
      });
      return retrySafeRead(() => client.auth.getUser(token));
    },
    loadPlayer: async (userId) => {
      // Import only after configuration is checked so a missing server key
      // produces the explicit configuration result, not a module-load crash.
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      if (options.profile === "home") return retrySafeRead(() => supabaseAdmin
        .from("players")
        .select("id, active, is_commissioner, show_survivor_standings, show_bowl_card, show_pool_chat, hide_pickem_eliminated_rows, hide_survivor_eliminated_rows")
        .eq("auth_user_id", userId)
        .maybeSingle());
      return retrySafeRead(() => supabaseAdmin
        .from("players")
        .select("id, active, is_commissioner")
        .eq("auth_user_id", userId)
        .maybeSingle());
    },
  });
}
