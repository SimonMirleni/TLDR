import { supabase } from './supabase';

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Builds the Google OAuth URL for the implicit ID-token flow used by Chrome
// extensions (per Supabase docs + Google Identity).
async function buildGoogleAuthUrl(): Promise<{
  authUrl: string;
  nonce: string;
  redirectUri: string;
}> {
  const clientId = chrome.runtime.getManifest().oauth2?.client_id;
  if (!clientId) {
    throw new Error('Missing OAuth client ID in extension manifest.');
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const url = new URL('https://accounts.google.com/o/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'id_token');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  // Supabase expects Google to echo the SHA-256 hash, while Supabase receives
  // the raw nonce for verification.
  const nonce = crypto.randomUUID();
  url.searchParams.set('nonce', await sha256Hex(nonce));
  return { authUrl: url.href, nonce, redirectUri };
}

export async function signInWithGoogle(): Promise<void> {
  const { authUrl, nonce, redirectUri } = await buildGoogleAuthUrl();
  const redirectedTo = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!redirectedTo) {
    const detail = chrome.runtime.lastError?.message;
    throw new Error(
      `Google sign-in was cancelled or failed.${detail ? ` ${detail}.` : ''} Extension ID: ${chrome.runtime.id}. Redirect URI: ${redirectUri}`,
    );
  }

  // The ID token lives in the URL fragment, e.g. https://<id>.chromiumapp.org/#id_token=...
  const hash = new URL(redirectedTo).hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');
  if (!idToken) {
    throw new Error('No id_token returned from Google.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce,
  });
  if (error) {
    throw new Error(`Supabase sign-in failed: ${error.message}`);
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
