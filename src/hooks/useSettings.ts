/* @refresh reset */
import { useCallback, useSyncExternalStore } from 'react';

interface AppSettings {
  sidebarAutoCollapseOnSchedule: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  sidebarAutoCollapseOnSchedule: true,
};

const SETTINGS_KEY = 'app-settings';
const SETTINGS_EVENT = 'app-settings-changed';

let cachedRaw: string | null | undefined = undefined;
let cachedSettings: AppSettings = DEFAULT_SETTINGS;

function readStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);

    // Return the cached object if nothing changed to avoid unnecessary rerenders.
    if (raw === cachedRaw) return cachedSettings;

    cachedRaw = raw;
    if (!raw) {
      cachedSettings = DEFAULT_SETTINGS;
      return cachedSettings;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
    return cachedSettings;
  } catch (e) {
    console.error('Error reading settings from localStorage:', e);
    cachedRaw = null;
    cachedSettings = DEFAULT_SETTINGS;
    return cachedSettings;
  }
}

function subscribe(callback: () => void) {
  const onChange = () => callback();
  window.addEventListener('storage', onChange);
  window.addEventListener(SETTINGS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SETTINGS_EVENT, onChange);
  };
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, readStoredSettings, () => DEFAULT_SETTINGS);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    const updated: AppSettings = { ...readStoredSettings(), ...newSettings };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      // Notify other hook instances in the same tab
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch (e) {
      console.error('Error saving settings to localStorage:', e);
    }
  }, []);

  return { settings, updateSettings };
}

