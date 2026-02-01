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

export function useTabs(): UseTabsResult {
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

  return { tabs, activeTab, loading, error, refresh };
}
