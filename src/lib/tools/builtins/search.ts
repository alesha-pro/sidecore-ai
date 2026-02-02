/**
 * Built-in Search Tool
 * Searches the web using Exa MCP server (keyless)
 */

import type { Tool } from '../types';
import { McpClient } from '../../mcp/client';

interface SearchToolParams {
  query: string;
  numResults?: number;
}

// Exa MCP server - free, no API key needed
const EXA_MCP_URL = 'https://mcp.exa.ai/mcp';

/**
 * Search tool implementation
 * Searches the web using Exa MCP and returns top results with snippets
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

    // Clamp numResults to reasonable bounds
    const clampedNumResults = Math.min(Math.max(numResults, 1), 10);

    try {
      const client = new McpClient(EXA_MCP_URL);

      // Call the Exa MCP search tool
      // Exa MCP tool name is "web_search_exa" with parameters: query, numResults
      const result = await client.callTool('web_search_exa', {
        query,
        numResults: clampedNumResults,
      });

      // Extract text content from MCP response
      const content = result.content;
      if (!content || content.length === 0) {
        return `No results found for "${query}"`;
      }

      // MCP returns content array with text items
      const textContent = content
        .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
        .map((item) => item.text)
        .join('\n');

      if (!textContent) {
        return `No results found for "${query}"`;
      }

      return textContent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return `Error: Failed to search "${query}": ${message}`;
    }
  },
};
