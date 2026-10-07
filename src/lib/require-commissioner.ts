import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolvePlayerAccess } from "@/lib/player-access-result";
import { retrySafeRead } from "@/lib/retry-safe-read";

type CommissionerProfile = {
  id: string;
  first_name: string;
  active: boolean;
  is_commissioner: boolean;
};

/** Request-scoped access; dependency failures remain distinct from denial. */
export async function requireCommissionerAccess(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");

  return resolvePlayerAccess({
    authorization,
    configured: Boolean(url && key && serverKey),
    requireCommissioner: true,
    verifyToken: async (token) => {
      const authClient = createClient(url!, key!, {
        global: { headers: { Authorization: authorization! } },
      });
      return authClient.auth.getUser(token);
    },
    loadPlayer: async (userId) => {
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      // Preserve the bounded retry for a transient profile read. Authorization
      // itself is never cached, and no commissioner action is retried here.
      const { data, error } = await retrySafeRead(() => supabaseAdmin
        .from("players")
        .select("id, first_name, active, is_commissioner")
        .eq("auth_user_id", userId)
        .maybeSingle());
      return { data: data as CommissionerProfile | null, error };
    },
  });
}

export function commissionerAccessFailure(access: { status: 401 | 403 | 500 | 503; code: string }) {
  const error = access.status === 401
    ? "Your sign-in session could not be verified."
    : access.status === 403
      ? "Commissioner access is required."
      : access.status === 500
        ? "The server is missing required configuration."
        : "Commissioner access could not be verified right now. Please try again.";
  return NextResponse.json({ error, code: access.code }, { status: access.status });
}
