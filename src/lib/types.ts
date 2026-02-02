/**
 * Tool call structure (matches OpenAI spec)
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON-encoded arguments */
    arguments: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string; // Optional thinking/reasoning content
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
  /** Tool calls made by assistant (only for role: 'assistant') */
  tool_calls?: ToolCall[];
  /** ID of the tool call this message is responding to (only for role: 'tool') */
  tool_call_id?: string;
  /** Name of the tool (for role: 'tool') */
  name?: string;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  contextBudget: number;
  stream: boolean;
  systemPrompt: string;
  savedModels: string[];
  showDebugPrompt: boolean;
  showExtractionStatus: boolean;
  responseLanguage: string;
  agentMode: boolean;
  agentMaxIterations: number;
  agentTimeoutMs: number;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto (match page language)' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'ja', label: 'Japanese' },
] as const;

export const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant integrated into a Chrome extension. Your role is to help users understand and analyze web page content from their browser tabs.

Context Capabilities:
- Users can select one or more browser tabs to include as context for their questions
- Each tab's main content is extracted using Mozilla's Readability library and converted to Markdown
- Context includes the page title and source URL for attribution
- Content may be truncated if it exceeds the configured character budget

Instructions:
- Provide clear, accurate, and well-structured responses in Markdown format
- When answering questions about provided context, reference specific sources (by title or URL)
- If the provided context is insufficient to answer a question, acknowledge this limitation
- Prioritize factual accuracy over speculation
- Be concise but thorough - optimize for user understanding`;

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  contextBudget: 50000,
  stream: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  savedModels: [],
  showDebugPrompt: false,
  showExtractionStatus: false,
  responseLanguage: 'auto',
  agentMode: false,
  agentMaxIterations: 15,
  agentTimeoutMs: 5 * 60 * 1000,
};

export interface TabSelection {
  includeActiveTab: boolean;
  selectedTabIds: Set<number>;
}

export const DEFAULT_TAB_SELECTION: TabSelection = {
  includeActiveTab: true,
  selectedTabIds: new Set(),
};

export interface Chat {
  id: string;
  title: string;           // Auto-generated from first user message (truncated to 50 chars)
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
}
