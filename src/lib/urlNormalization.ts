/**
 * Normalize an API base URL.
 * Minimal processing - preserves user's path as-is.
 * Only adds https:// if missing and removes trailing slashes.
 *
 * @example
 * normalizeBaseUrl('api.openai.com/v1') => 'https://api.openai.com/v1'
 * normalizeBaseUrl('https://my-server.com/api') => 'https://my-server.com/api'
 * normalizeBaseUrl('https://api.openai.com/v1/') => 'https://api.openai.com/v1'
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();

  if (!url) {
    return '';
  }

  // Ensure https:// prefix (upgrade http to https)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  return url;
}

/**
 * Check if a URL is valid for use as a base URL.
 * Returns error message or null if valid.
 */
export function validateBaseUrl(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return 'Base URL is required';
  }

  try {
    normalizeBaseUrl(trimmed);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid URL';
  }
}
