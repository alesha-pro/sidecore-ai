import { extractTabs } from '../background/extraction/extractTabs';
import type { TabInfo } from '../lib/tabs';
import type { ExtractedTabContent } from '../shared/extraction';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Handle extraction requests from sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  });
});
