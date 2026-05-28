import type { Database } from '@rld/db';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { MiddlewareHandler } from 'hono';
import { createUserClient } from '../services/supabase.js';

export type AuthedEnv = {
  Variables: {
    user: User;
    supabase: SupabaseClient<Database>;
    jwt: string;
  };
};

export const requireAuth: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'unauthorized', message: 'Missing Bearer token' } }, 401);
  }
  const jwt = header.slice('Bearer '.length).trim();

  const supabase = createUserClient(jwt);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return c.json({ error: { code: 'unauthorized', message: 'Invalid token' } }, 401);
  }

  c.set('user', data.user);
  c.set('supabase', supabase);
  c.set('jwt', jwt);
  await next();
};
