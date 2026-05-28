import { addDetectedTab, removeDetectedTab, syncBadge } from '@/lib/detected-tabs';
import { getLocalSettings } from '@/lib/local-settings';
import { supabase } from '@/lib/supabase';
import { isDismissedOrSaved, markSaved } from '@/lib/suppress';
import { defineBackground } from 'wxt/sandbox';

const ALARM_PREFIX = 'rl_inactive_';
const BLOG_TABS_KEY = 'rl_blog_tabs';

interface BlogTabInfo {
  url: string;
  title: string;
}

async function getBlogTabs(): Promise<Record<string, BlogTabInfo>> {
  const result = await chrome.storage.local.get(BLOG_TABS_KEY);
  return (result[BLOG_TABS_KEY] as Record<string, BlogTabInfo>) ?? {};
}

async function setBlogTabs(tabs: Record<string, BlogTabInfo>): Promise<void> {
  await chrome.storage.local.set({ [BLOG_TABS_KEY]: tabs });
}

async function startAlarm(tabId: number): Promise<void> {
  const { inactiveTimeoutMin } = await getLocalSettings();
  // Clear first so the timer resets each time the tab goes to background.
  await chrome.alarms.clear(`${ALARM_PREFIX}${tabId}`);
  await chrome.alarms.create(`${ALARM_PREFIX}${tabId}`, { delayInMinutes: inactiveTimeoutMin });
}

async function cancelAlarm(tabId: number): Promise<void> {
  await chrome.alarms.clear(`${ALARM_PREFIX}${tabId}`);
}

export default defineBackground(() => {
  type IncomingMsg =
    | { type: 'BLOG_DETECTED'; url: string; title: string }
    | { type: 'TAB_BACKGROUNDED'; url: string }
    | { type: 'TAB_FOREGROUNDED'; url: string }
    | { type: 'SAVE_PAGE'; url: string; content: string };

  chrome.runtime.onMessage.addListener((msg: IncomingMsg, sender) => {
    const tabId = sender.tab?.id;

    if (msg.type === 'BLOG_DETECTED') {
      if (!tabId) return;
      void (async () => {
        const tabs = await getBlogTabs();
        tabs[String(tabId)] = { url: msg.url, title: msg.title };
        await setBlogTabs(tabs);
      })();
      return;
    }

    if (msg.type === 'TAB_BACKGROUNDED') {
      if (!tabId) return;
      void startAlarm(tabId);
      return;
    }

    if (msg.type === 'TAB_FOREGROUNDED') {
      if (!tabId) return;
      void cancelAlarm(tabId);
      return;
    }

    if (msg.type === 'SAVE_PAGE') {
      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from('resources').insert({ url: msg.url, content: msg.content } as never);
        await markSaved(msg.url);
        if (tabId) {
          const tabs = await getBlogTabs();
          delete tabs[String(tabId)];
          await setBlogTabs(tabs);
          await cancelAlarm(tabId);
        }
      })();
    }
  });

  // When user returns to a tab, cancel its inactive alarm.
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void cancelAlarm(tabId);
  });

  // Clean up when a tab is closed.
  chrome.tabs.onRemoved.addListener((tabId) => {
    void (async () => {
      await cancelAlarm(tabId);
      const tabs = await getBlogTabs();
      delete tabs[String(tabId)];
      await setBlogTabs(tabs);
      await removeDetectedTab(tabId);
      await syncBadge();
    })();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith(ALARM_PREFIX)) return;
    const tabId = Number(alarm.name.slice(ALARM_PREFIX.length));
    if (Number.isNaN(tabId)) return;

    void (async () => {
      // Confirm tab still exists.
      try {
        await chrome.tabs.get(tabId);
      } catch {
        const tabs = await getBlogTabs();
        delete tabs[String(tabId)];
        await setBlogTabs(tabs);
        return;
      }

      // Race: user may have returned to the tab just as the alarm fired.
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (active?.id === tabId) return;

      const blogTabs = await getBlogTabs();
      const info = blogTabs[String(tabId)];
      if (!info) return;

      if (await isDismissedOrSaved(info.url)) {
        delete blogTabs[String(tabId)];
        await setBlogTabs(blogTabs);
        return;
      }

      await addDetectedTab({ tabId, url: info.url, title: info.title });
      await syncBadge();
    })();
  });
});
