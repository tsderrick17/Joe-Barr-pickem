import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type VapidKeys = { publicKey: string; privateKey: string };

let kept: VapidKeys | null = null;

async function stored(): Promise<VapidKeys | null> {
  const { data, error } = await supabaseAdmin.from("push_vapid_keys").select("public_key, private_key").eq("id", true).maybeSingle();
  if (error) throw new Error("The notification keys could not be read.");
  return data ? { publicKey: data.public_key, privateKey: data.private_key } : null;
}

/**
 * The pool's Web Push signing keys. Made once, the first time anyone turns notifications on, and kept in the database so every server instance
 * signs with the same pair. If two instances make a pair at the same moment, the first one stored wins and both use it.
 */
export async function vapidKeys(): Promise<VapidKeys> {
  if (kept) return kept;
  let keys = await stored();
  if (!keys) {
    const made = webpush.generateVAPIDKeys();
    const { error } = await supabaseAdmin.from("push_vapid_keys").upsert({ id: true, public_key: made.publicKey, private_key: made.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("The notification keys could not be saved.");
    keys = await stored();
    if (!keys) throw new Error("The notification keys could not be read after saving.");
  }
  kept = keys;
  return keys;
}

/** Forgets the copy kept in memory (for tests). */
export function forgetVapidKeys() { kept = null; }
