// src/lib/tabs.ts
import { browser } from 'wxt/browser';

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  windowId: number;
}

export async function getAllTabs(): Promise<TabInfo[]> {
  const tabs = await browser.tabs.query({});
  return tabs
    .filter((tab): tab is typeof tab & { id: number; url: string } =>
      tab.id !== undefined && tab.url !== undefined
    )
    .map((tab) => ({
      id: tab.id,
      title: tab.title || tab.url || 'Untitled',
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      active: tab.active ?? false,
      windowId: tab.windowId ?? 0,
    }));
}

export async function getActiveTab(): Promise<TabInfo | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.url) return null;
  return {
    id: tab.id,
    title: tab.title || tab.url || 'Untitled',
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    active: true,
    windowId: tab.windowId ?? 0,
  };
}
