import { defineContentScript } from 'wxt/sandbox';

// Listens for a SCRAPE request from the popup and returns the current page's
// raw innerText + URL. Frozen at request time — never re-scraped.
type ScrapeRequest = { type: 'SCRAPE' };
export type ScrapeResponse = { url: string; content: string };

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((msg: ScrapeRequest, _sender, sendResponse) => {
      if (msg?.type !== 'SCRAPE') return;
      const response: ScrapeResponse = {
        url: location.href,
        content: document.body?.innerText ?? '',
      };
      sendResponse(response);
      // We responded synchronously; no need to return true.
    });
  },
});
