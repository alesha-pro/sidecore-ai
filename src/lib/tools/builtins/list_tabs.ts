/**
 * Built-in List Tabs Tool
 * Returns all open browser tabs with their IDs, titles, and URLs
 */

import type { Tool } from '../types';

/**
 * List tabs tool implementation
 * Returns information about all open browser tabs
 */
export const listTabsTool: Tool<Record<string, never>> = {
  name: 'list_tabs',
  description: 'List all open browser tabs. Returns each tab\'s ID, title, and URL. Use this to discover what tabs the user has open before reading their content.',
  source: 'built-in',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<string> {
    try {
      // Query all tabs directly using chrome.tabs API
      const tabs = await chrome.tabs.query({});

      // Filter out tabs without id or url, and map to structured format
      const tabList = tabs
        .filter((tab): tab is typeof tab & { id: number; url: string } =>
          tab.id !== undefined && tab.url !== undefined
        )
        .map((tab) => ({
          tabId: tab.id,
          title: tab.title || tab.url || 'Untitled',
          url: tab.url,
        }));

      // Return as JSON string for the LLM
      return JSON.stringify(tabList, null, 2);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return `Error: Failed to list tabs: ${message}`;
    }
  },
};
