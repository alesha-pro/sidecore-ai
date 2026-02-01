// src/hooks/useTabs.ts
import { useState, useEffect, useCallback } from 'preact/hooks';
import { browser } from 'wxt/browser';
import type { TabInfo } from '../lib/tabs';

interface UseTabsResult {
  tabs: TabInfo[];
  activeTab: TabInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTabs(onTabClosed?: (tabId: number) => void): UseTabsResult {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTab, setActiveTab] = useState<TabInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allTabs = await browser.tabs.query({});
      const mapped: TabInfo[] = allTabs
        .filter((tab): tab is typeof tab & { id: number; url: string } =>
          tab.id !== undefined && tab.url !== undefined
        )
        .map((tab, index) => ({
          id: tab.id,
          title: tab.title || tab.url || 'Untitled',
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          active: tab.active ?? false,
          windowId: tab.windowId ?? 0,
          index,
        }));

      setTabs(mapped);

      // Find active tab in current window
      const active = mapped.find((t) => t.active) || null;
      setActiveTab(active);
    } catch (err) {
      console.error('Failed to fetch tabs:', err);
      setError('Failed to load tabs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to Chrome tab events for real-time updates
  useEffect(() => {
    // Handler for new tabs created
    const handleTabCreated = (tab: chrome.tabs.Tab) => {
      if (tab.id === undefined) return;

      // Tab might not have URL yet (still loading)
      const newTabInfo: TabInfo = {
        id: tab.id,
        title: tab.title || tab.url || 'New Tab',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl,
        active: tab.active ?? false,
        windowId: tab.windowId ?? 0,
        index: tab.index,
      };

      setTabs((prev) => [...prev, newTabInfo]);
    };

    // Handler for tabs removed
    const handleTabRemoved = (tabId: number) => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId));

      // Update activeTab if the closed tab was active
      setActiveTab((prev) => (prev?.id === tabId ? null : prev));

      // Notify parent component to clean up selection
      onTabClosed?.(tabId);
    };

    // Handler for tab updates (URL, title changes)
    const handleTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      // Only update on meaningful changes to avoid unnecessary rerenders
      if (!changeInfo.url && !changeInfo.title && !changeInfo.favIconUrl) {
        return;
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          return {
            ...t,
            title: tab.title || tab.url || t.title,
            url: tab.url || t.url,
            favIconUrl: tab.favIconUrl ?? t.favIconUrl,
          };
        })
      );

      // Update activeTab if it's the one that changed
      setActiveTab((prev) => {
        if (prev?.id !== tabId) return prev;
        return {
          ...prev,
          title: tab.title || tab.url || prev.title,
          url: tab.url || prev.url,
          favIconUrl: tab.favIconUrl ?? prev.favIconUrl,
        };
      });
    };

    // Handler for tab activation changes
    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      const { tabId, windowId } = activeInfo;

      // Update active flags across all tabs
      setTabs((prev) =>
        prev.map((t) => ({
          ...t,
          active: t.id === tabId && t.windowId === windowId,
        }))
      );

      // Update activeTab state
      setTabs((prev) => {
        const newActive = prev.find((t) => t.id === tabId) || null;
        setActiveTab(newActive);
        return prev;
      });
    };

    // Add event listeners
    browser.tabs.onCreated.addListener(handleTabCreated);
    browser.tabs.onRemoved.addListener(handleTabRemoved);
    browser.tabs.onUpdated.addListener(handleTabUpdated);
    browser.tabs.onActivated.addListener(handleTabActivated);

    // Cleanup on unmount
    return () => {
      browser.tabs.onCreated.removeListener(handleTabCreated);
      browser.tabs.onRemoved.removeListener(handleTabRemoved);
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
      browser.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [onTabClosed]);

  return { tabs, activeTab, loading, error, refresh };
}
