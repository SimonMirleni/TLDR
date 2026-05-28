import type { ScrapeResponse } from '@/entrypoints/content';

// Restricted URL prefixes where chrome content scripts can't be injected.
const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
];

function isRestricted(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

export async function scrapeActiveTab(): Promise<ScrapeResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || isRestricted(tab.url)) {
    throw new Error('This page cannot be scraped (chrome:// or webstore page).');
  }

  // Send a message to the content script already injected at document_idle.
  // If the user opens the popup before document_idle fires, sendMessage rejects;
  // surface that as a friendlier error.
  try {
    const response = (await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' })) as
      | ScrapeResponse
      | undefined;
    if (!response || !response.content) {
      throw new Error('Page had no text content.');
    }
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Receiving end does not exist')) {
      throw new Error('Page not ready yet — refresh the tab and try again.');
    }
    throw err;
  }
}
