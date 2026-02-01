import type { Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

const STORAGE_KEY = 'settings';

/**
 * Get settings from chrome.storage.local.
 * Returns default settings if none are saved.
 */
export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    if (result[STORAGE_KEY]) {
      // Merge with defaults to handle new fields in updates
      return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] };
    }
    return { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to chrome.storage.local.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw new Error('Failed to save settings');
  }
}

/**
 * Listen for settings changes from other contexts (e.g., options page).
 */
export function onSettingsChange(callback: (settings: Settings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[STORAGE_KEY]?.newValue) {
      callback({ ...DEFAULT_SETTINGS, ...changes[STORAGE_KEY].newValue });
    }
  };

  chrome.storage.local.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => {
    chrome.storage.local.onChanged.removeListener(listener);
  };
}
