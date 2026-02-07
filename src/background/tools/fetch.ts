/**
 * Background fetch helper for tool calls
 * Provides CORS-bypass fetching from the background service worker
 */

export interface FetchUrlOptions {
  url: string;
  timeoutMs?: number;
  maxChars?: number;
}

export interface FetchUrlResult {
  ok: boolean;
  status: number;
  statusText: string;
  finalUrl: string;
  contentType: string;
  bodyText: string;
}

export interface FetchUrlError {
  error: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_CHARS = 1_000_000;

/**
 * Fetch a URL with timeout and content limits
 * Returns structured result or error
 */
export async function fetchUrl(
  options: FetchUrlOptions
): Promise<FetchUrlResult | FetchUrlError> {
  const { url, timeoutMs = DEFAULT_TIMEOUT_MS, maxChars = DEFAULT_MAX_CHARS } = options;

  // Validate URL scheme
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: `Invalid URL: ${url}` };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { error: `Unsupported URL scheme: ${parsedUrl.protocol} (only http/https allowed)` };
  }

  // Check host permission before fetching
  const originPattern = `${parsedUrl.protocol}//${parsedUrl.host}/*`;
  try {
    const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
    if (!hasPermission) {
      return {
        error: `No permission to access ${parsedUrl.host}. Grant access to this domain in the extension settings or permission prompt.`,
      };
    }
  } catch {
    // permissions API may not be available in all contexts, proceed with fetch
  }

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Use a common user agent to avoid bot detection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    // Read response as text
    let bodyText = await response.text();

    // Clamp to maxChars
    if (bodyText.length > maxChars) {
      bodyText = bodyText.slice(0, maxChars);
    }

    const contentType = response.headers.get('content-type') || '';

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
      contentType,
      bodyText,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { error: `Request timed out after ${timeoutMs}ms` };
      }
      return { error: err.message };
    }
    return { error: 'Unknown fetch error' };
  }
}
