/**
 * Built-in Fetch Tool
 * Fetches URLs via background service worker (CORS bypass) and returns Markdown content
 */

import type { Tool } from '../types';
import type { FetchUrlResult } from '../../../background/tools/fetch';
import { convertHtmlToMarkdown } from '../../extraction/htmlToMarkdown';

interface FetchToolParams {
  url: string;
}

interface FetchResponse {
  success: boolean;
  result?: FetchUrlResult;
  error?: string;
}

const MAX_RAW_TEXT_LENGTH = 50_000;

/**
 * Fetch tool implementation
 * Fetches a URL and returns its content as Markdown
 */
export const fetchTool: Tool<FetchToolParams> = {
  name: 'fetch',
  description: 'Fetch a URL and return its main content in Markdown. Use this to read web pages, articles, documentation, or any HTTP resource.',
  source: 'built-in',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch (must be http:// or https://)',
      },
    },
    required: ['url'],
  },

  async execute(args: FetchToolParams): Promise<string> {
    const { url } = args;

    // Validate URL scheme
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return `Error: Invalid URL "${url}"`;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return `Error: Unsupported URL scheme "${parsedUrl.protocol}". Only http:// and https:// are supported.`;
    }

    // Fetch via background service worker
    let response: FetchResponse;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'tool-fetch',
        url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return `Error: Failed to fetch "${url}": ${message}`;
    }

    // Handle fetch failure
    if (!response.success || !response.result) {
      return `Error: Failed to fetch "${url}": ${response.error || 'Unknown error'}`;
    }

    const { result } = response;

    // Handle non-OK response
    if (!result.ok) {
      return `Error: HTTP ${result.status} ${result.statusText} for "${url}"`;
    }

    // Process based on content type
    const contentType = result.contentType.toLowerCase();

    if (contentType.includes('text/html')) {
      // Convert HTML to Markdown
      const { title, markdown } = convertHtmlToMarkdown(result.bodyText, result.finalUrl);

      // Build attributed response
      const attribution = `# ${title}\nSource: ${result.finalUrl}\n\n`;
      return attribution + markdown;
    }

    // For non-HTML content, return raw text in a fenced block
    let rawText = result.bodyText.trim();
    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
      rawText = rawText.slice(0, MAX_RAW_TEXT_LENGTH) + '\n\n[Content truncated...]';
    }

    // Determine language hint from content type
    let lang = '';
    if (contentType.includes('json')) {
      lang = 'json';
    } else if (contentType.includes('xml')) {
      lang = 'xml';
    } else if (contentType.includes('javascript')) {
      lang = 'javascript';
    } else if (contentType.includes('css')) {
      lang = 'css';
    }

    return `Source: ${result.finalUrl}\n\n\`\`\`${lang}\n${rawText}\n\`\`\``;
  },
};
