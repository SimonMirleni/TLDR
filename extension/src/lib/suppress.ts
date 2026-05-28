const DISMISSED_KEY = 'rl_dismissed_urls';
const SAVED_KEY = 'rl_saved_urls';

async function getSet(key: string): Promise<Set<string>> {
  const result = await chrome.storage.local.get(key);
  const arr = result[key];
  return new Set(Array.isArray(arr) ? (arr as string[]) : []);
}

async function addToSet(key: string, url: string): Promise<void> {
  const set = await getSet(key);
  set.add(url);
  await chrome.storage.local.set({ [key]: Array.from(set) });
}

export async function isDismissedOrSaved(url: string): Promise<boolean> {
  const [dismissed, saved] = await Promise.all([getSet(DISMISSED_KEY), getSet(SAVED_KEY)]);
  return dismissed.has(url) || saved.has(url);
}

export async function dismissUrl(url: string): Promise<void> {
  await addToSet(DISMISSED_KEY, url);
}

export async function markSaved(url: string): Promise<void> {
  await addToSet(SAVED_KEY, url);
}
