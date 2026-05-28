import { defineBackground } from 'wxt/sandbox';

// The background service worker exists primarily to keep the extension alive and
// to hold the persisted Supabase session (chrome.storage). All auth and DB calls
// happen from the popup, which imports the same supabase client and storage
// adapter — chrome.storage is shared across contexts so the session is visible
// to both popup and background.
export default defineBackground(() => {
  // No-op for now. Reserved for future message routing if popup-content traffic
  // grows beyond direct tabs.sendMessage.
});
