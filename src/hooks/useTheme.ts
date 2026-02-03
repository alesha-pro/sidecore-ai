import { useState, useEffect, useCallback } from 'preact/hooks';
import { getSettings, saveSettings, onSettingsChange } from '@/lib/storage';
import type { ThemeMode } from '@/lib/types';

/**
 * Apply theme class to document element
 */
function applyTheme(mode: ThemeMode): void {
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Hook for managing theme state with persistence and system preference detection
 *
 * Features:
 * - Loads theme from chrome.storage on mount
 * - Listens for storage changes from other contexts (e.g., settings page)
 * - Listens for system preference changes when in 'auto' mode
 * - Persists theme changes to chrome.storage
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('auto');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme from storage on mount
  useEffect(() => {
    getSettings().then((settings) => {
      setThemeState(settings.theme);
      applyTheme(settings.theme);
      setIsLoaded(true);
    });
  }, []);

  // Listen for settings changes from other contexts
  useEffect(() => {
    const unsubscribe = onSettingsChange((settings) => {
      setThemeState(settings.theme);
      applyTheme(settings.theme);
    });
    return unsubscribe;
  }, []);

  // Listen for system preference changes when in 'auto' mode
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      // Re-apply theme to update based on new system preference
      applyTheme('auto');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Set theme and persist to storage
  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyTheme(newTheme);

    try {
      const settings = await getSettings();
      await saveSettings({ ...settings, theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  return {
    theme,
    setTheme,
    isLoaded,
  };
}
