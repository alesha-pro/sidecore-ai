import { extractTabs } from '../background/extraction/extractTabs';
import { fetchUrl } from '../background/tools/fetch';
import { debugLog } from '../lib/debug';
import type { TabInfo } from '../lib/tabs';
import type { ExtractedTabContent } from '../shared/extraction';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Create context menu items on install
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'summarize-page',
      title: 'Summarize this page',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'ask-about-page',
      title: 'Ask about this page',
      contexts: ['page'],
    });
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id || !tab.windowId) return;

    debugLog('[background] Context menu clicked:', info.menuItemId, 'tab:', tab.id);

    // Open side panel FIRST (must be synchronous response to user gesture)
    chrome.sidePanel.open({ windowId: tab.windowId });
    debugLog('[background] Side panel open called');

    // Then store pending action in session storage
    chrome.storage.session.set({
      pendingContextMenuAction: {
        action: info.menuItemId,
        tab: { id: tab.id, title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl },
        timestamp: Date.now(),
      },
    }).then(() => {
      debugLog('[background] Pending action saved to session storage');
    });
  });

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
  });
});
