import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Plain (stateless, no cookies) Supabase client using the public anon key.
 * Used by the /api/auth/* routes, which exist so the extension can sign in
 * directly with email/password instead of asking the user to copy a
 * personal token - those routes proxy to Supabase Auth without needing a
 * browser cookie jar, since the caller is the extension, not this app's
 * own pages.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
