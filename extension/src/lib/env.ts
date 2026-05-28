// Build-time env injected by WXT/Vite from .env at the repo root (WXT_ prefix).
// These exports default to empty strings if missing — the popup's bootstrap
// (`popup/main.ts`) validates them up front and renders a friendly error so a
// missing variable doesn't show up as a silent "Loading…" hang.

export const SUPABASE_URL: string = import.meta.env.WXT_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.WXT_SUPABASE_ANON_KEY ?? '';
export const BACKEND_URL: string = import.meta.env.WXT_BACKEND_URL ?? '';
export const GOOGLE_CLIENT_ID: string = import.meta.env.WXT_GOOGLE_CLIENT_ID ?? '';

export type EnvKey =
  | 'WXT_SUPABASE_URL'
  | 'WXT_SUPABASE_ANON_KEY'
  | 'WXT_BACKEND_URL'
  | 'WXT_GOOGLE_CLIENT_ID';

export function findMissingEnv(): EnvKey[] {
  const pairs: Array<[EnvKey, string]> = [
    ['WXT_SUPABASE_URL', SUPABASE_URL],
    ['WXT_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
    ['WXT_BACKEND_URL', BACKEND_URL],
    ['WXT_GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID],
  ];
  return pairs.filter(([, v]) => !v).map(([k]) => k);
}
