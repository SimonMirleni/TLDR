import { getSession, signInWithGoogle, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { renderQueue } from './queue';
import { renderSettings } from './settings';

type Tab = 'queue' | 'settings';

const root = document.getElementById('app') as HTMLElement;

async function render(): Promise<void> {
  const session = await getSession();
  if (!session) {
    renderSignedOut();
    return;
  }
  renderSignedIn(session.user.email ?? '(unknown)');
}

function renderSignedOut(): void {
  const manifestClientId = chrome.runtime.getManifest().oauth2?.client_id ?? '(missing)';
  const redirectUri = chrome.identity.getRedirectURL();
  root.innerHTML = `
    <h1>ReadLater Digest</h1>
    <p class="muted">Sign in with Google to start saving pages.</p>
    <button id="signin" class="primary">Sign in with Google</button>
    <p id="status" class="status"></p>
    <details class="debug">
      <summary>OAuth diagnostics</summary>
      <label>Extension ID</label>
      <code>${escapeHtml(chrome.runtime.id)}</code>
      <label>Redirect URI</label>
      <code>${escapeHtml(redirectUri)}</code>
      <label>Google Client ID</label>
      <code>${escapeHtml(manifestClientId)}</code>
    </details>
  `;
  const status = root.querySelector('#status') as HTMLElement;
  root.querySelector('#signin')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    status.className = 'status';
    status.textContent = 'Opening Google…';
    try {
      await signInWithGoogle();
      await render();
    } catch (err) {
      status.className = 'status error';
      status.textContent = err instanceof Error ? err.message : String(err);
      btn.disabled = false;
    }
  });
}

function renderSignedIn(email: string): void {
  root.innerHTML = `
    <div class="signed-in">
      Signed in as <strong>${escapeHtml(email)}</strong>
      <a href="#" id="signout" style="margin-left:8px">Sign out</a>
    </div>
    <div class="tabs">
      <button data-tab="queue" class="active">Queue</button>
      <button data-tab="settings">Settings</button>
    </div>
    <section id="tab-body"></section>
  `;

  root.querySelector('#signout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
    await render();
  });

  const tabButtons = root.querySelectorAll<HTMLButtonElement>('.tabs button');
  const body = root.querySelector('#tab-body') as HTMLElement;

  const switchTo = async (tab: Tab) => {
    for (const b of tabButtons) {
      b.classList.toggle('active', b.dataset.tab === tab);
    }
    body.innerHTML = '';
    if (tab === 'queue') {
      await renderQueue(body);
    } else {
      await renderSettings(body);
    }
  };

  for (const b of tabButtons) {
    b.addEventListener('click', () => {
      void switchTo(b.dataset.tab as Tab);
    });
  }

  void switchTo('queue');
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

export function startApp(): void {
  supabase.auth.onAuthStateChange(() => {
    void render();
  });
  void render();
}
