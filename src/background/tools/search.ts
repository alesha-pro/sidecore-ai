/**
 * Background Exa search helper for tool calls
 * Provides web search via Exa API from the background service worker
 */

export interface SearchExaOptions {
  query: string;
  apiKey: string;
  numResults?: number;
  timeoutMs?: number;
}

export interface ExaSearchResult {
  title: string;
  url: string;
  text: string;
}

export interface SearchExaSuccess {
  ok: true;
  results: ExaSearchResult[];
}

export interface SearchExaError {
  ok: false;
  error: string;
}

export type SearchExaResult = SearchExaSuccess | SearchExaError;

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_NUM_RESULTS = 5;

/**
 * Search the web using Exa API
 * Returns structured results or error
 */
export async function searchExa(options: SearchExaOptions): Promise<SearchExaResult> {
  const {
    query,
    apiKey,
    numResults = DEFAULT_NUM_RESULTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Validate inputs
  if (!query.trim()) {
    return { ok: false, error: 'Query cannot be empty' };
  }

  if (!apiKey.trim()) {
    return { ok: false, error: 'API key is required' };
  }

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        numResults,
        contents: { text: true },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        ok: false,
        error: `Exa API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
      };
    }

    const data = await response.json();

    // Parse results
    const results: ExaSearchResult[] = (data.results || []).map((result: {
      title?: string;
      url?: string;
      text?: string;
      highlights?: string[];
    }) => ({
      title: result.title || 'Untitled',
      url: result.url || '',
      text: result.text || result.highlights?.[0] || '',
    }));

    return { ok: true, results };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { ok: false, error: `Request timed out after ${timeoutMs}ms` };
      }
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Unknown search error' };
  }
}
