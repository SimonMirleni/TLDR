function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  RESEND_API_KEY: required('RESEND_API_KEY'),
  ALLOWED_EXTENSION_ORIGIN: required('ALLOWED_EXTENSION_ORIGIN'),
  PORT: Number.parseInt(process.env.PORT ?? '8787', 10),
};
