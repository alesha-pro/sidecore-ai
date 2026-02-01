export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  contextBudget: number;
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  contextBudget: 50000,
};

export interface TabSelection {
  includeActiveTab: boolean;    // CTX-01: active tab on by default
  selectedTabIds: Set<number>;  // CTX-03: additionally selected tabs
}

export const DEFAULT_TAB_SELECTION: TabSelection = {
  includeActiveTab: true,
  selectedTabIds: new Set(),
};
