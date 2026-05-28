import { findMissingEnv } from '@/lib/env';

// Catch-all so any module-load throw surfaces visibly instead of leaving the
// popup stuck on the initial "Loading…" placeholder.
window.addEventListener('error', (e) => {
  renderFatal(`Unexpected error: ${e.message}`);
});
window.addEventListener('unhandledrejection', (e) => {
  renderFatal(`Unexpected error: ${String(e.reason)}`);
});

function renderFatal(message: string): void {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = `
    <h1>ReadLater Digest</h1>
    <p class="status error">${escapeHtml(message)}</p>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

const missing = findMissingEnv();
if (missing.length > 0) {
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `
      <h1>Setup required</h1>
      <p class="status error">Missing build-time env var(s):</p>
      <ul>
        ${missing.map((m) => `<li><code>${m}</code></li>`).join('')}
      </ul>
      <p class="muted">
        Copy <code>.env.example</code> to <code>.env</code> at the repo root,
        fill in the values, then rebuild the extension
        (<code>pnpm dev:extension</code>) and reload it in
        <code>chrome://extensions</code>.
      </p>
    `;
  }
} else {
  // All required env present — load and run the app.
  void import('./app')
    .then((mod) => mod.startApp())
    .catch((err) => {
      renderFatal(err instanceof Error ? err.message : String(err));
    });
}
