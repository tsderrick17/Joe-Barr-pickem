import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { resolvePlayerAccess } from "@/lib/player-access-result";

/** A request-scoped authentication result; no authorization state is cached. */
export async function authenticateActivePlayer(request: NextRequest, requireCommissioner = false) {
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
      return supabaseAdmin
        .from("players")
        .select("id, active, is_commissioner")
        .eq("auth_user_id", userId)
        .maybeSingle();
    },
  });
}
