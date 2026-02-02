export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string; // Optional thinking/reasoning content
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  contextBudget: number;
  stream: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  contextBudget: 50000,
  stream: true,
};

export interface TabSelection {
  includeActiveTab: boolean;
  selectedTabIds: Set<number>;
}

export const DEFAULT_TAB_SELECTION: TabSelection = {
  includeActiveTab: true,
  selectedTabIds: new Set(),
};
