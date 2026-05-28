import { Resend } from 'resend';
import { env } from '../env.js';

const resend = new Resend(env.RESEND_API_KEY);

// V1: Resend sandbox sender. Only delivers to the address registered in the
// Resend account. Replace with a verified domain (e.g. digest@yourdomain.com)
// before opening the extension to multiple users.
const FROM = 'ReadLater Digest <onboarding@resend.dev>';

export async function sendNewsletterEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<string> {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    throw new Error(`Resend failed: ${error.message ?? JSON.stringify(error)}`);
  }
  if (!data?.id) {
    throw new Error('Resend returned no email id');
  }
  return data.id;
}
