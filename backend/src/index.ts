import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { type AuthedEnv, requireAuth } from './middleware/auth.js';
import { newsletterSend } from './routes/newsletter-send.js';

const app = new Hono<AuthedEnv>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.ALLOWED_EXTENSION_ORIGIN,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

app.post('/newsletter/send', requireAuth, newsletterSend);

app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ error: { code: 'internal', message: 'Internal server error' } }, 500);
});

serve({ fetch: app.fetch, port: env.PORT });
console.log(`[backend] listening on :${env.PORT}`);
