export interface DetectedTab {
  tabId: number;
  url: string;
  title: string;
}

const KEY = 'rl_detected_tabs';

export async function getDetectedTabs(): Promise<DetectedTab[]> {
  const result = await chrome.storage.local.get(KEY);
  const arr = result[KEY];
  return Array.isArray(arr) ? (arr as DetectedTab[]) : [];
}

export async function addDetectedTab(tab: DetectedTab): Promise<void> {
  const tabs = await getDetectedTabs();
  if (!tabs.some((t) => t.tabId === tab.tabId)) {
    await chrome.storage.local.set({ [KEY]: [...tabs, tab] });
  }
}

export async function removeDetectedTab(tabId: number): Promise<void> {
  const tabs = await getDetectedTabs();
  await chrome.storage.local.set({ [KEY]: tabs.filter((t) => t.tabId !== tabId) });
}

export async function syncBadge(): Promise<void> {
  const tabs = await getDetectedTabs();
  const count = tabs.length;
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) await chrome.action.setBadgeBackgroundColor({ color: '#1a1a1a' });
}
