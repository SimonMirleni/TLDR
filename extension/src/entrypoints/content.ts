import { isBlogPage } from '@/lib/detect';
import { getLocalSettings } from '@/lib/local-settings';
import { dismissUrl, isDismissedOrSaved, markSaved } from '@/lib/suppress';
import { defineContentScript } from 'wxt/sandbox';

type ScrapeRequest = { type: 'SCRAPE' };
export type ScrapeResponse = { url: string; content: string };

type OutgoingMessage =
  | { type: 'BLOG_DETECTED'; url: string; title: string }
  | { type: 'TAB_BACKGROUNDED'; url: string }
  | { type: 'TAB_FOREGROUNDED'; url: string }
  | { type: 'SAVE_PAGE'; url: string; content: string };

function sendMsg(msg: OutgoingMessage): void {
  try {
    chrome.runtime.sendMessage(msg);
  } catch {
    // Extension reloading or service worker unavailable — swallow silently.
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    chrome.runtime.onMessage.addListener((msg: ScrapeRequest, _sender, sendResponse) => {
      if (msg?.type !== 'SCRAPE') return;
      sendResponse({
        url: location.href,
        content: document.body?.innerText ?? '',
      } as ScrapeResponse);
    });

    if (!isBlogPage()) return;

    const suppressed = await isDismissedOrSaved(location.href);
    if (suppressed) return;

    const url = location.href;
    const settings = await getLocalSettings();

    sendMsg({ type: 'BLOG_DETECTED', url, title: document.title });
    if (document.hidden) sendMsg({ type: 'TAB_BACKGROUNDED', url });

    // ── 2-min dwell timer (visible time only) ──────────────────────────────
    const dwellMs = settings.dwellTimeMin * 60_000;
    let elapsed = 0;
    let startTime: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let overlayShown = false;

    function resume() {
      if (overlayShown || startTime !== null || document.hidden) return;
      startTime = Date.now();
      timerId = setTimeout(showOverlay, dwellMs - elapsed);
    }

    function pause() {
      if (startTime === null) return;
      elapsed += Date.now() - startTime;
      startTime = null;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pause();
        sendMsg({ type: 'TAB_BACKGROUNDED', url });
      } else {
        resume();
        sendMsg({ type: 'TAB_FOREGROUNDED', url });
      }
    });

    if (!document.hidden) resume();

    // ── Save-prompt overlay (Shadow DOM to avoid page CSS conflicts) ────────
    function showOverlay() {
      if (overlayShown) return;
      overlayShown = true;

      const host = document.createElement('div');
      host.id = 'rl-prompt-host';
      document.body.append(host);

      const shadow = host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        .wrap {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          background: #f7f5f0;
          color: #1a1a1a;
          border: 1px solid #1a1a1a;
          padding: 16px 18px;
          font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
          font-size: 13px;
          max-width: 280px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 4px 4px 0 #1a1a1a;
        }
        p { margin: 0; font-weight: 600; line-height: 1.45; }
        .actions { display: flex; gap: 8px; }
        button {
          flex: 1;
          padding: 7px 0;
          border: 1px solid #1a1a1a;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.03em;
        }
        .save { background: #1a1a1a; color: #f7f5f0; }
        .save:hover { background: #333; border-color: #333; }
        .dismiss { color: #6b6560; border-color: #d9d4cc; }
        .dismiss:hover { background: #1a1a1a; color: #f7f5f0; border-color: #1a1a1a; }
      `;

      const wrap = document.createElement('div');
      wrap.className = 'wrap';

      const msg = document.createElement('p');
      msg.textContent = '¿Querés guardar esta página para leer después?';

      const actions = document.createElement('div');
      actions.className = 'actions';

      const btnSave = document.createElement('button');
      btnSave.className = 'save';
      btnSave.textContent = 'Guardar';
      btnSave.addEventListener('click', () => {
        host.remove();
        sendMsg({ type: 'SAVE_PAGE', url, content: document.body?.innerText ?? '' });
        void markSaved(url);
      });

      const btnDismiss = document.createElement('button');
      btnDismiss.className = 'dismiss';
      btnDismiss.textContent = 'No, gracias';
      btnDismiss.addEventListener('click', () => {
        host.remove();
        void dismissUrl(url);
      });

      actions.append(btnSave, btnDismiss);
      wrap.append(msg, actions);
      shadow.append(style, wrap);
    }
  },
});
