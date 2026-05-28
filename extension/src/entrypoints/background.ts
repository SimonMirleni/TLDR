import { defineBackground } from 'wxt/sandbox';
import { signInWithGoogle } from '@/lib/auth';

// Auth runs here, not in the popup, because Chrome closes the popup when the
// OAuth window steals focus — killing any in-flight JS. The service worker
// survives focus changes, so the OAuth round-trip completes reliably.
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SIGN_IN') {
      signInWithGoogle()
        .then(() => {
          sendResponse({ ok: true });
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : String(err);
          console.error('[background] sign-in failed:', error);
          sendResponse({ ok: false, error });
        });
      return true; // keep message channel open for async response
    }
  });
});
