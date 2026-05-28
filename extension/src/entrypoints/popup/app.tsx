import { getSession, signInWithGoogle, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { render as renderPreact } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { renderQueue } from './queue';
import { renderSettings } from './settings';

type Tab = 'queue' | 'settings';

const root = document.getElementById('app') as HTMLElement;

function App() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      const session = await getSession();
      if (!cancelled) {
        setEmail(session ? (session.user.email ?? '(unknown)') : null);
      }
    };

    void loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (email === undefined) {
    return <p class="loading">Loading…</p>;
  }

  return email ? <SignedIn email={email} /> : <SignedOut />;
}

function SignedOut() {
  const [status, setStatus] = useState<{ text: string; kind: 'error' | '' }>({
    text: '',
    kind: '',
  });
  const [signingIn, setSigningIn] = useState(false);
  const manifestClientId = chrome.runtime.getManifest().oauth2?.client_id ?? '(missing)';
  const redirectUri = chrome.identity.getRedirectURL();

  const handleSignIn = async () => {
    setSigningIn(true);
    setStatus({ text: 'Opening Google…', kind: '' });
    try {
      await signInWithGoogle();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : String(err), kind: 'error' });
      setSigningIn(false);
    }
  };

  return (
    <div class="sign-in-panel">
      <h1>ReadLater Digest</h1>
      <p class="muted">Sign in with Google to start saving pages.</p>
      <button type="button" id="signin" class="primary" disabled={signingIn} onClick={handleSignIn}>
        {signingIn ? 'Signing in...' : 'Sign in with Google'}
      </button>
      <p id="status" class={`status${status.kind ? ` ${status.kind}` : ''}`}>
        {status.text}
      </p>
      <details class="debug">
        <summary>OAuth diagnostics</summary>
        <span class="debug-label">Extension ID</span>
        <code>{chrome.runtime.id}</code>
        <span class="debug-label">Redirect URI</span>
        <code>{redirectUri}</code>
        <span class="debug-label">Google Client ID</span>
        <code>{manifestClientId}</code>
      </details>
    </div>
  );
}

function SignedIn({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('queue');

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div class="signed-in">
        Signed in as <strong>{email}</strong>
        <button type="button" id="signout" class="link-button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
      <div class="tabs">
        <button
          type="button"
          class={tab === 'queue' ? 'active' : ''}
          onClick={() => setTab('queue')}
        >
          Queue
        </button>
        <button
          type="button"
          class={tab === 'settings' ? 'active' : ''}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>
      <section id="tab-body">{tab === 'queue' ? renderQueue() : renderSettings()}</section>
    </>
  );
}

export function startApp(): void {
  renderPreact(<App />, root);
}
