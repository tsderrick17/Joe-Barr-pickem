import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Whether the clubhouse (the light switch in the header and /clubhouse) is open to every player, the Commissioner's one switch for
 * launching it. Read from the pool's settings row; if it cannot be read it reads as closed, so a fault never opens it by accident.
 */
export async function clubhouseOpenToAll(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.from("pool_settings").select("clubhouse_open").eq("id", true).maybeSingle();
    return !error && Boolean(data?.clubhouse_open);
  } catch {
    return false;
  }
}
