/**
 * Normalize an OpenAI-compatible API base URL.
 * Handles common variations:
 * - With/without https:// prefix
 * - With/without trailing slash
 * - With/without /v1 suffix
 *
 * @example
 * normalizeBaseUrl('api.openai.com') => 'https://api.openai.com/v1'
 * normalizeBaseUrl('https://api.openai.com/') => 'https://api.openai.com/v1'
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

  // Remove /v1 suffix if present (we'll add it back)
  if (url.endsWith('/v1')) {
    url = url.slice(0, -3);
  }

  // Add /v1 suffix
  url = url + '/v1';

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
