import { getSession, signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Resource } from '@rld/db';
import { render as renderPreact } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

type NewTabResource = Pick<Resource, 'id' | 'url' | 'content' | 'created_at'>;
type StatusKind = 'error' | '';

const root = document.getElementById('app') as HTMLElement;
const RESOURCE_LIMIT = 12;
const EXCERPT_LENGTH = 320;

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
  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({ text: '', kind: '' });
  const [signingIn, setSigningIn] = useState(false);

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
    <section class="shell narrow hero-card">
      <p class="eyebrow">TLDR</p>
      <h1>Your reading list, every new tab.</h1>
      <p class="lead">Sign in to see pending reads as quick preview cards.</p>
      <button type="button" class="primary" disabled={signingIn} onClick={handleSignIn}>
        Sign in with Google
      </button>
      <p class={`status${status.kind ? ` ${status.kind}` : ''}`}>{status.text}</p>
    </section>
  );
}

function SignedIn({ email }: { email: string }) {
  const [resources, setResources] = useState<NewTabResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({ text: '', kind: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('resources')
      .select('id, url, content, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(RESOURCE_LIMIT);

    if (error) {
      setResources([]);
      setStatus({ text: `Failed to load: ${error.message}`, kind: 'error' });
      setLoading(false);
      return;
    }

    setResources(data ?? []);
    setStatus({ text: '', kind: '' });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">TLDR</p>
          <h1>Pending reads</h1>
        </div>
        <div class="account">
          <span>{email}</span>
          <button type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>
      <p class="lead">
        Oldest saved pages first. Previews are generated locally from the content you already
        captured.
      </p>
      <p class={`status${status.kind ? ` ${status.kind}` : ''}`}>{status.text}</p>
      <ResourceGrid resources={resources} loading={loading} />
    </section>
  );
}

function ResourceGrid({ resources, loading }: { resources: NewTabResource[]; loading: boolean }) {
  if (loading) {
    return <p class="empty">Loading your reading list…</p>;
  }

  if (resources.length === 0) {
    return (
      <div class="empty-state">
        <h2>No pending reads.</h2>
        <p>Save a page from the extension popup and it will appear here.</p>
      </div>
    );
  }

  return (
    <div class="grid">
      {resources.map((resource, index) => (
        <article class="card" key={resource.id}>
          <div class="card-meta">
            <span>#{index + 1}</span>
            <time dateTime={resource.created_at}>{formatDate(resource.created_at)}</time>
          </div>
          <h2>{displayTitle(resource.url)}</h2>
          <p>{buildExcerpt(resource.content)}</p>
          <a href={resource.url} target="_blank" rel="noreferrer">
            Open original →
          </a>
        </article>
      ))}
    </div>
  );
}

function buildExcerpt(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No text preview available.';
  if (normalized.length <= EXCERPT_LENGTH) return normalized;
  return `${normalized.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

function displayTitle(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.length > 64 ? `${url.slice(0, 61)}…` : url;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function startApp(): void {
  renderPreact(<App />, root);
}
