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
