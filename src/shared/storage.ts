import { normalizeSettings, type Settings } from './types';

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(KEY);
  return normalizeSettings(data[KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export function onSettingsChanged(cb: (settings: Settings) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area === 'local' && changes[KEY]) {
      cb(normalizeSettings(changes[KEY].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
