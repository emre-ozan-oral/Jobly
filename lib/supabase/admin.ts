import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. This BYPASSES Row Level Security, so it
 * must only be used server-side, and only for the one thing that needs it:
 * the extension's /api/capture endpoint, which authenticates by a personal
 * API token (not a login session) and has to look up which user that token
 * belongs to before it can know whose jobs table to write into. Every
 * query made with this client must have its own explicit user_id filter -
 * nothing stops it from reading/writing any user's rows otherwise.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set - required for /api/capture and /api/tokens"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
