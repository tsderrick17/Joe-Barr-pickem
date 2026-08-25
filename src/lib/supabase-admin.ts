import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer the credential maintained by the Vercel/Supabase integration. Keep
// the older variable name as a compatibility fallback for local builds and
// isolated rehearsals, but do not let a stale manually-entered key override
// the managed production credential.
const configuredSupabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !configuredSupabaseServerKey) {
  throw new Error("Missing server-side Supabase configuration.");
}

export const supabaseServerKey = configuredSupabaseServerKey;

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServerKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
