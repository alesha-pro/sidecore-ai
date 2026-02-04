/**
 * Built-in Read Tabs Tool
 * Reads the content of specified browser tabs via the extract-tabs pipeline
 */

import type { Tool } from '../types';
import type { ExtractedTabContent } from '../../../shared/extraction';
import type { TabInfo } from '../../tabs';

interface ReadTabsParams {
  tabIds: number[];
}

interface ExtractTabsResponse {
  success: boolean;
  results?: ExtractedTabContent[];
  error?: string;
}

const DEFAULT_BUDGET = 50_000;

/**
 * Read tabs tool implementation
 * Extracts the main content of specified tabs as Markdown
 */
export const readTabsTool: Tool<ReadTabsParams> = {
  name: 'read_tabs',
  description: 'Read the content of specified browser tabs. Extracts the main content as Markdown. Pass tab IDs obtained from list_tabs. Returns the extracted content for each tab.',
  source: 'built-in',
  parameters: {
    type: 'object',
    properties: {
      tabIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of tab IDs to read content from (get IDs from list_tabs)',
      },
    },
    required: ['tabIds'],
  },

  async execute(args: ReadTabsParams): Promise<string> {
    const { tabIds } = args;

    // Validate tabIds
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return 'Error: tabIds must be a non-empty array of tab IDs';
    }

    try {
      // Build TabInfo array by querying chrome.tabs for each ID
      const tabInfoResults = await Promise.allSettled(
        tabIds.map(async (tabId) => {
          const tab = await chrome.tabs.get(tabId);
          if (!tab.url) {
            throw new Error(`Tab ${tabId} has no URL`);
          }
          return {
            id: tabId,
            title: tab.title || tab.url || 'Untitled',
            url: tab.url,
            favIconUrl: tab.favIconUrl,
            active: tab.active ?? false,
            windowId: tab.windowId ?? 0,
            index: tab.index ?? 0,
          } as TabInfo;
        })
      );

      // Collect successful tab info, track failures
      const tabInfoArray: TabInfo[] = [];
      const failedTabs: Array<{ tabId: number; error: string }> = [];

      tabInfoResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          tabInfoArray.push(result.value);
        } else {
          const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
          failedTabs.push({ tabId: tabIds[idx], error: message });
        }
      });

      // If all tabs failed, return error
      if (tabInfoArray.length === 0) {
        const errorMessages = failedTabs.map((f) => `Tab ${f.tabId}: ${f.error}`).join('\n');
        return `Error: Failed to get info for all tabs:\n${errorMessages}`;
      }

      // Send extract-tabs message to background (reuses existing pipeline)
      const response: ExtractTabsResponse = await chrome.runtime.sendMessage({
        type: 'extract-tabs',
        tabs: tabInfoArray,
        budget: DEFAULT_BUDGET,
      });

      // Handle extraction failure
      if (!response.success || !response.results) {
        return `Error: Failed to extract tab content: ${response.error || 'Unknown error'}`;
      }

      // Format results into readable string
      const results = response.results;
      const output: string[] = [];

      // Add failed tab info first (if any)
      if (failedTabs.length > 0) {
        output.push('# Failed to access some tabs:');
        failedTabs.forEach((f) => {
          output.push(`- Tab ${f.tabId}: ${f.error}`);
        });
        output.push('');
      }

      // Format extracted content
      for (const result of results) {
        output.push(`# Tab: ${result.title}`);
        output.push(`URL: ${result.url}`);
        output.push('');

        if (result.error) {
          output.push(`Error: ${result.error.message}`);
        } else {
          output.push(result.markdown);
          if (result.truncated) {
            output.push('');
            output.push('[Content truncated due to budget limit]');
          }
        }

        output.push('');
        output.push('---');
        output.push('');
      }

      return output.join('\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return `Error: Failed to read tabs: ${message}`;
    }
  },
};
