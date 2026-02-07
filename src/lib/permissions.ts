/**
 * PermissionGate — centralized permission management with anti-spam
 *
 * Provides contains/request/ensure* API for three access classes:
 * 1. Active tab read (scripting on current tab) — via activeTab permission
 * 2. Multi-tab read (scripting on any tab) — via <all_urls> optional host permission
 * 3. External origin (network access to specific domains) — via optional host permissions
 *
 * Anti-spam strategy:
 * - Deny cooldown: after user denies, suppress re-prompts for DENY_COOLDOWN_MS
 * - Chrome permissions.request() is only called on explicit user click
 * - After grant, no further prompts for that access class
 */

const DENY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = 'permissionDenials';

export type PermissionResult =
  | { status: 'granted' }
  | { status: 'already-granted' }
  | { status: 'denied' }
  | { status: 'cooldown'; retryAfter: number };

interface DenialRecord {
  timestamp: number;
}

type DenialMap = Record<string, DenialRecord>;

// ============================================================================
// Internal helpers
// ============================================================================

async function getDenials(): Promise<DenialMap> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as DenialMap) || {};
  } catch {
    return {};
  }
}

async function setDenial(key: string): Promise<void> {
  const denials = await getDenials();
  denials[key] = { timestamp: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEY]: denials });
}

async function clearDenial(key: string): Promise<void> {
  const denials = await getDenials();
  delete denials[key];
  await chrome.storage.local.set({ [STORAGE_KEY]: denials });
}

function isInCooldown(denial: DenialRecord | undefined): denial is DenialRecord {
  if (!denial) return false;
  return Date.now() - denial.timestamp < DENY_COOLDOWN_MS;
}

/**
 * Normalize a URL to its origin pattern for chrome.permissions API.
 * e.g. "https://api.openai.com/v1/chat/completions" -> "https://api.openai.com/*"
 */
export function toOriginPattern(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

// ============================================================================
// Public API: contains (check without prompting)
// ============================================================================

/**
 * Check if the extension currently has host permission for a given origin pattern.
 */
export async function containsHostPermission(originPattern: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [originPattern] });
}

/**
 * Check if the extension has <all_urls> host permission (for multi-tab).
 */
export async function containsAllUrlsPermission(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ['<all_urls>'] });
}

// ============================================================================
// Public API: request (prompt user)
// ============================================================================

/**
 * Request host permission for a specific origin, with cooldown.
 * Only call this in response to a direct user action (click).
 */
export async function requestHostPermission(originPattern: string): Promise<PermissionResult> {
  const key = `host:${originPattern}`;

  // Check already granted
  if (await containsHostPermission(originPattern)) {
    return { status: 'already-granted' };
  }

  // Check cooldown
  const denials = await getDenials();
  if (isInCooldown(denials[key])) {
    const retryAfter = DENY_COOLDOWN_MS - (Date.now() - denials[key].timestamp);
    return { status: 'cooldown', retryAfter };
  }

  // Request via Chrome API
  const granted = await chrome.permissions.request({ origins: [originPattern] });

  if (granted) {
    await clearDenial(key);
    return { status: 'granted' };
  } else {
    await setDenial(key);
    return { status: 'denied' };
  }
}

/**
 * Request <all_urls> for multi-tab access, with cooldown.
 */
export async function requestAllUrlsPermission(): Promise<PermissionResult> {
  const key = 'host:<all_urls>';

  if (await containsAllUrlsPermission()) {
    return { status: 'already-granted' };
  }

  const denials = await getDenials();
  if (isInCooldown(denials[key])) {
    const retryAfter = DENY_COOLDOWN_MS - (Date.now() - denials[key].timestamp);
    return { status: 'cooldown', retryAfter };
  }

  const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });

  if (granted) {
    await clearDenial(key);
    return { status: 'granted' };
  } else {
    await setDenial(key);
    return { status: 'denied' };
  }
}

// ============================================================================
// Public API: ensure* (high-level helpers for UI integration)
// ============================================================================

/**
 * Ensure we can extract content from the active tab.
 *
 * With activeTab permission, extraction works for the current tab
 * after user gesture (clicking send). This always succeeds if activeTab
 * is in the manifest and the page is not restricted.
 */
export function ensureActiveTabAccess(): PermissionResult {
  // activeTab is a mandatory permission — always granted after user gesture
  return { status: 'already-granted' };
}

/**
 * Ensure we can extract content from multiple tabs (requires <all_urls>).
 * Returns the current state without prompting — caller decides when to prompt.
 */
export async function checkMultiTabAccess(): Promise<
  { granted: true } | { granted: false; inCooldown: boolean; retryAfter?: number }
> {
  if (await containsAllUrlsPermission()) {
    return { granted: true };
  }

  const denials = await getDenials();
  const denial = denials['host:<all_urls>'];
  if (isInCooldown(denial)) {
    const retryAfter = DENY_COOLDOWN_MS - (Date.now() - denial.timestamp);
    return { granted: false, inCooldown: true, retryAfter };
  }

  return { granted: false, inCooldown: false };
}

/**
 * Ensure we have network access to a specific external origin.
 * Returns the current state without prompting — caller decides when to prompt.
 */
export async function checkExternalOriginAccess(baseUrl: string): Promise<
  { granted: true } | { granted: false; origin: string; inCooldown: boolean; retryAfter?: number }
> {
  const origin = toOriginPattern(baseUrl);
  if (!origin) {
    // Invalid URL — treat as granted (will fail at fetch level)
    return { granted: true };
  }

  if (await containsHostPermission(origin)) {
    return { granted: true };
  }

  const key = `host:${origin}`;
  const denials = await getDenials();
  if (isInCooldown(denials[key])) {
    const retryAfter = DENY_COOLDOWN_MS - (Date.now() - denials[key].timestamp);
    return { granted: false, origin, inCooldown: true, retryAfter };
  }

  return { granted: false, origin, inCooldown: false };
}

/**
 * Reset denial cooldown for a specific key. Used for explicit "try again" actions.
 */
export async function resetDenialCooldown(key: string): Promise<void> {
  await clearDenial(key);
}

/**
 * Reset all denial cooldowns. Used for "grant access" in settings.
 */
export async function resetAllDenials(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
