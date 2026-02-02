import { extractTabs } from '../background/extraction/extractTabs';
import { fetchUrl } from '../background/tools/fetch';
import { searchExa } from '../background/tools/search';
import type { TabInfo } from '../lib/tabs';
import type { ExtractedTabContent } from '../shared/extraction';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Handle messages from sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle extraction requests
    if (message.type === 'extract-tabs') {
      const { tabs, budget } = message as {
        type: 'extract-tabs';
        tabs: TabInfo[];
        budget: number;
      };

      // Execute extraction asynchronously
      extractTabs(tabs, budget)
        .then((results: ExtractedTabContent[]) => {
          sendResponse({ success: true, results });
        })
        .catch((error) => {
          console.error('Extraction failed:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      // Return true to indicate async response
      return true;
    }

    // Handle tool fetch requests (CORS bypass)
    if (message.type === 'tool-fetch') {
      const { url } = message as { type: 'tool-fetch'; url: string };

      fetchUrl({ url })
        .then((result) => {
          if ('error' in result) {
            sendResponse({ success: false, error: result.error });
          } else {
            sendResponse({ success: true, result });
          }
        })
        .catch((error) => {
          console.error('Tool fetch failed:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      // Return true to indicate async response
      return true;
    }

    // Handle tool search requests (Exa API)
    if (message.type === 'tool-search') {
      const { query, apiKey, numResults } = message as {
        type: 'tool-search';
        query: string;
        apiKey: string;
        numResults?: number;
      };

      searchExa({ query, apiKey, numResults })
        .then((result) => {
          if (result.ok) {
            sendResponse({ success: true, result });
          } else {
            sendResponse({ success: false, error: result.error });
          }
        })
        .catch((error) => {
          console.error('Tool search failed:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      // Return true to indicate async response
      return true;
    }
  });
});
