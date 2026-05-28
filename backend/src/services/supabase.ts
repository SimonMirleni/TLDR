import type { Database } from '@rld/db';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

// Per-request Supabase client authenticated with the caller's JWT.
// RLS policies on `resources` and `settings` will scope every query to
// auth.uid() = <jwt sub>.
export function createUserClient(jwt: string): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
}
