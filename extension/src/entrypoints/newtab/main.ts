import { findMissingEnv } from '@/lib/env';

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
    <section class="shell narrow">
      <h1>ReadLater Digest</h1>
      <p class="status error">${escapeHtml(message)}</p>
    </section>
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
      <section class="shell narrow">
        <h1>Setup required</h1>
        <p class="status error">Missing build-time env var(s):</p>
        <ul>
          ${missing.map((m) => `<li><code>${m}</code></li>`).join('')}
        </ul>
      </section>
    `;
  }
} else {
  void import('./app')
    .then((mod) => mod.startApp())
    .catch((err) => {
      renderFatal(err instanceof Error ? err.message : String(err));
    });
}
