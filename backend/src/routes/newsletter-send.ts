import { DEFAULT_RESOURCES_PER_NEWSLETTER, DEFAULT_TONE_PROMPT } from '@rld/db';
import type { Context } from 'hono';
import type { AuthedEnv } from '../middleware/auth.js';
import { sendNewsletterEmail } from '../services/email.js';
import { summarizeArticles } from '../services/llm.js';

const LLM_TIMEOUT_MS = 60_000;

export async function newsletterSend(c: Context<AuthedEnv>): Promise<Response> {
  const user = c.get('user');
  const supabase = c.get('supabase');

  const email = user.email;
  if (!email) {
    return c.json({ error: { code: 'no_email', message: 'JWT has no email claim' } }, 400);
  }

  // 1. Load settings (lazy: row may not exist).
  const { data: settingsRow, error: settingsError } = await supabase
    .from('settings')
    .select('tone_prompt, resources_per_newsletter')
    .eq('user_id', user.id)
    .maybeSingle();
  if (settingsError) {
    console.error('[newsletter] settings load failed', settingsError);
    return c.json({ error: { code: 'db_error', message: settingsError.message } }, 500);
  }

  const tonePrompt = settingsRow?.tone_prompt ?? DEFAULT_TONE_PROMPT;
  const n = settingsRow?.resources_per_newsletter ?? DEFAULT_RESOURCES_PER_NEWSLETTER;

  // 2. Select N oldest pending resources (RLS scopes to this user).
  const { data: resources, error: selectError } = await supabase
    .from('resources')
    .select('id, url, content')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(n);

  if (selectError) {
    console.error('[newsletter] select failed', selectError);
    return c.json({ error: { code: 'db_error', message: selectError.message } }, 500);
  }

  if (!resources || resources.length === 0) {
    return c.json({ sent: false, reason: 'no_pending' as const });
  }

  // 3. LLM with timeout.
  let digest: import('../services/llm.js').DigestOutput;
  try {
    const result = await summarizeArticles(
      tonePrompt,
      resources.map((r) => ({ id: r.id, url: r.url, content: r.content })),
      AbortSignal.timeout(LLM_TIMEOUT_MS),
    );
    digest = result.digest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[newsletter] LLM failed', msg);
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
    return c.json(
      { error: { code: isTimeout ? 'llm_timeout' : 'llm_error', message: msg } },
      isTimeout ? 504 : 502,
    );
  }

  // 4. Send email.
  let emailId: string;
  try {
    emailId = await sendNewsletterEmail({
      to: email,
      subject: `Your ReadLater digest — ${resources.length} article${resources.length === 1 ? '' : 's'}`,
      digest,
      articleCount: resources.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[newsletter] email failed', msg);
    return c.json({ error: { code: 'email_failed', message: msg } }, 502);
  }

  // 5. Mark consumed. Done last on purpose (see plan §4: best-effort optimistic).
  const ids = resources.map((r) => r.id);
  const { error: updateError } = await supabase
    .from('resources')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .in('id', ids);

  if (updateError) {
    // Email already sent. Log and continue — user will see the same items in
    // the queue and may re-send (accepted V1 trade-off).
    console.error('[newsletter] UPDATE consumed failed after email sent', updateError);
  }

  return c.json({
    sent: true as const,
    emailId,
    consumedCount: resources.length,
    consumedUrls: resources.map((r) => r.url),
  });
}
