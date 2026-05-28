import { BACKEND_URL } from './env';
import { supabase } from './supabase';

export type SendResult =
  | { sent: true; emailId: string; consumedCount: number; consumedUrls: string[] }
  | { sent: false; reason: 'no_pending' };

export async function sendNewsletter(): Promise<SendResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not signed in.');
  }

  const res = await fetch(`${BACKEND_URL}/newsletter/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return (await res.json()) as SendResult;
}
