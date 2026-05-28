export interface LocalSettings {
  dwellTimeMin: number;
  inactiveTimeoutMin: number;
}

export const LOCAL_SETTINGS_DEFAULTS: LocalSettings = {
  dwellTimeMin: 2,
  inactiveTimeoutMin: 30,
};

export async function getLocalSettings(): Promise<LocalSettings> {
  const result = await chrome.storage.local.get(['rl_dwell_time_min', 'rl_inactive_timeout_min']);
  return {
    dwellTimeMin:
      typeof result.rl_dwell_time_min === 'number'
        ? result.rl_dwell_time_min
        : LOCAL_SETTINGS_DEFAULTS.dwellTimeMin,
    inactiveTimeoutMin:
      typeof result.rl_inactive_timeout_min === 'number'
        ? result.rl_inactive_timeout_min
        : LOCAL_SETTINGS_DEFAULTS.inactiveTimeoutMin,
  };
}

export async function setLocalSettings(patch: Partial<LocalSettings>): Promise<void> {
  const data: Record<string, number> = {};
  if (patch.dwellTimeMin !== undefined) data.rl_dwell_time_min = patch.dwellTimeMin;
  if (patch.inactiveTimeoutMin !== undefined)
    data.rl_inactive_timeout_min = patch.inactiveTimeoutMin;
  if (Object.keys(data).length) await chrome.storage.local.set(data);
}
