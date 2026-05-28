const REMOVE_AFTER_SEND_KEY = 'readingList.removeAfterSend';

export type ReadingListEntry = chrome.readingList.ReadingListEntry;

export type ReadingListImportResult = {
  imported: number;
  skipped: number;
  failed: number;
};

export type ReadingListRemoveResult = {
  removed: number;
  failed: number;
};

export function isReadingListAvailable(): boolean {
  return typeof chrome.readingList?.query === 'function';
}

export async function listUnreadReadingListEntries(): Promise<ReadingListEntry[]> {
  if (!isReadingListAvailable()) return [];

  const entries = await chrome.readingList.query({ hasBeenRead: false });
  return entries.sort((a, b) => a.creationTime - b.creationTime);
}

export function getImportableReadingListEntries(
  entries: ReadingListEntry[],
  existingUrls: Iterable<string>,
): ReadingListEntry[] {
  const existing = new Set(existingUrls);
  return entries.filter((entry) => isImportableUrl(entry.url) && !existing.has(entry.url));
}

export async function captureReadingListEntry(entry: ReadingListEntry): Promise<string> {
  const response = await fetch(entry.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!contentType.includes('text/html')) {
    if (!text) throw new Error('No text content.');
    return text;
  }

  const doc = new DOMParser().parseFromString(text, 'text/html');
  const content = doc.body?.innerText ?? '';
  if (!content) throw new Error('No text content.');
  return content;
}

export async function removeReadingListUrls(
  urls: Iterable<string>,
): Promise<ReadingListRemoveResult> {
  let removed = 0;
  let failed = 0;

  if (!isReadingListAvailable()) {
    return { removed, failed: Array.from(urls).length };
  }

  for (const url of urls) {
    try {
      await chrome.readingList.removeEntry({ url });
      removed += 1;
    } catch (err) {
      console.warn('[reading-list] remove failed', url, err);
      failed += 1;
    }
  }

  return { removed, failed };
}

export async function getRemoveReadingListAfterSend(): Promise<boolean> {
  const result = await chrome.storage.local.get(REMOVE_AFTER_SEND_KEY);
  return result[REMOVE_AFTER_SEND_KEY] === true;
}

export async function setRemoveReadingListAfterSend(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [REMOVE_AFTER_SEND_KEY]: enabled });
}

function isImportableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
