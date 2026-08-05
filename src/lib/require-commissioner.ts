import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireCommissioner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;

  const authClient = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await authClient.auth.getUser(
    authorization.slice("Bearer ".length),
  );
  if (!user) return null;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, first_name, active, is_commissioner")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return player?.active && player.is_commissioner ? player : null;
}
