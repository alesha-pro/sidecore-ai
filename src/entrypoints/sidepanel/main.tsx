import { render } from 'preact';
import App from './App';
import './styles.css';

/**
 * Apply theme class to document element
 * Called synchronously before render and reactively when preference changes
 */
function applyTheme(mode: 'light' | 'dark' | 'auto'): void {
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
 * Initialize theme before first render to prevent FOUC (Flash of Unstyled Content)
 *
 * Strategy:
 * 1. Immediately apply based on system preference (instant, covers most cases)
 * 2. Load actual preference from chrome.storage (async)
 * 3. Correct if user has explicit light/dark preference different from system
 */
async function initializeTheme(): Promise<void> {
  // Phase 1: Instant application based on system preference
  // This prevents flash for 'auto' mode users (the default)
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (systemPrefersDark) {
    document.documentElement.classList.add('dark');
  }

  // Phase 2: Load actual preference and correct if needed
  try {
    const result = await chrome.storage.local.get(['settings']);
    const theme = result.settings?.theme || 'auto';
    applyTheme(theme);
  } catch (error) {
    // Storage read failed, keep system preference (already applied)
    console.warn('Failed to load theme preference:', error);
  }
}

// Initialize theme immediately (before render)
initializeTheme();

// Render app
render(<App />, document.getElementById('root')!);
