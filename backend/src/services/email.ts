import { render } from '@react-email/render';
import * as React from 'react';
import { Resend } from 'resend';
import { DigestEmail } from '../emails/digest.js';
import { env } from '../env.js';
import type { DigestOutput } from './llm.js';

const resend = new Resend(env.RESEND_API_KEY);

// V1: Resend sandbox sender. Only delivers to the address registered in the
// Resend account. Replace with a verified domain (e.g. digest@yourdomain.com)
// before opening the extension to multiple users.
const FROM = 'ReadLater Digest <onboarding@resend.dev>';

export async function sendNewsletterEmail(opts: {
  to: string;
  subject: string;
  digest: DigestOutput;
  articleCount: number;
}): Promise<string> {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = await render(
    React.createElement(DigestEmail, {
      digest: opts.digest,
      date,
      articleCount: opts.articleCount,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed: ${error.message ?? JSON.stringify(error)}`);
  }
  if (!data?.id) {
    throw new Error('Resend returned no email id');
  }
  return data.id;
}
