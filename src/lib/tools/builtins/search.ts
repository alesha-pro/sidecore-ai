/**
 * Built-in Search Tool
 * Searches the web using Exa API via background service worker
 */

import type { Tool } from '../types';
import type { SearchExaSuccess } from '../../../background/tools/search';
import { getSettings } from '../../storage';

interface SearchToolParams {
  query: string;
  numResults?: number;
}

interface SearchResponse {
  success: boolean;
  result?: SearchExaSuccess;
  error?: string;
}

interface SearchResultOutput {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search tool implementation
 * Searches the web using Exa and returns top results with snippets
 */
export const searchTool: Tool<SearchToolParams> = {
  name: 'search',
  description: 'Search the web using Exa and return top results with snippets. Use this to find current information, research topics, or locate web resources.',
  source: 'built-in',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up',
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return (default: 5, max: 10)',
      },
    },
    required: ['query'],
  },

  async execute(args: SearchToolParams): Promise<string> {
    const { query, numResults = 5 } = args;

    // Validate query
    if (!query.trim()) {
      return 'Error: Search query cannot be empty';
    }

    // Load settings to get API key
    let apiKey: string;
    try {
      const settings = await getSettings();
      apiKey = settings.exaApiKey;
    } catch (err) {
      return 'Error: Failed to load settings';
    }

    // Check for API key
    if (!apiKey || !apiKey.trim()) {
      return 'Error: Exa API key not configured. Please add your API key in Settings > Advanced > Web Search (Exa) API Key.';
    }

    // Clamp numResults to reasonable bounds
    const clampedNumResults = Math.min(Math.max(numResults, 1), 10);

    // Search via background service worker
    let response: SearchResponse;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'tool-search',
        query,
        apiKey,
        numResults: clampedNumResults,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return `Error: Failed to search "${query}": ${message}`;
    }

    // Handle search failure
    if (!response.success || !response.result) {
      return `Error: Search failed for "${query}": ${response.error || 'Unknown error'}`;
    }

    // Format results
    const results: SearchResultOutput[] = response.result.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.text.slice(0, 500) + (r.text.length > 500 ? '...' : ''),
    }));

    // Build output
    if (results.length === 0) {
      return `No results found for "${query}"`;
    }

    const output = {
      query,
      results,
    };

    return JSON.stringify(output, null, 2);
  },
};
