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

/**
 * Theme mode for UI appearance
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

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
  /** Marks this as an extracted-content system message (for content-as-history) */
  contentMessageId?: string;
  /** Follow-up suggestion texts (max 3, assistant messages only) */
  suggestions?: string[];
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
  agentMaxIterations: number;
  agentTimeoutMs: number;
  mcpServers: McpServerConfig[];
  /** Tool names to disable (won't be sent to LLM) */
  disabledTools: string[];
  /** MCP server IDs to disable (tools won't be registered) */
  disabledServers: string[];
  theme: ThemeMode;
  /** Model context limit in tokens (used by ContextAssembler) */
  modelContextLimit: number;
  /** Title generation: enabled */
  titleGenEnabled: boolean;
  /** Title generation: use same provider as main model */
  titleGenUseSameProvider: boolean;
  /** Title generation: separate base URL */
  titleGenBaseUrl: string;
  /** Title generation: separate API key */
  titleGenApiKey: string;
  /** Title generation: model name */
  titleGenModel: string;
  /** Title generation: saved models for dropdown */
  titleGenSavedModels: string[];
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

export const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant in a Chrome extension that helps users understand web content and perform tasks using available tools.

## Context
- Users select browser tabs as context (extracted as Markdown with title and URL)
- Content may be truncated; acknowledge when context seems incomplete
- Reference sources by title or URL when answering

## Tools
You have access to tools via function calling. Use them effectively:

**When to use tools:**
- Information not in provided context requires external lookup
- Task requires actions (search, fetch, compute, interact)
- User explicitly requests tool-based actions

**When NOT to use tools:**
- Answer is clearly available in provided context
- Simple questions, summaries, or analysis of given content
- Speculation or opinion-based responses

**Tool execution:**
- Call tools with precise, complete parameters
- Wait for tool results before proceeding
- If a tool fails, explain the error and suggest alternatives
- Chain multiple tools when task requires sequential steps

## Reasoning Approach
For complex tasks, think step-by-step:
1. Clarify what the user needs
2. Identify required information/actions
3. Determine if tools are needed
4. Execute and synthesize results
5. Provide clear, actionable response

## Response Format
- Use Markdown for structure (headers, lists, code blocks)
- Be concise—prioritize clarity over verbosity
- Cite sources when referencing context
- Acknowledge limitations honestly`;

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
  agentMaxIterations: 15,
  agentTimeoutMs: 5 * 60 * 1000,
  mcpServers: [],
  disabledTools: [],
  disabledServers: [],
  theme: 'auto',
  modelContextLimit: 128000,
  titleGenEnabled: true,
  titleGenUseSameProvider: true,
  titleGenBaseUrl: '',
  titleGenApiKey: '',
  titleGenModel: '',
  titleGenSavedModels: [],
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

// ============================================================================
// MCP Server Configuration
// ============================================================================

/**
 * Header key-value pair for MCP server authentication
 */
export interface McpHeader {
  key: string;
  value: string;
}

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  headers: McpHeader[];
}

// ============================================================================
// LLM Provider Presets
// ============================================================================

/**
 * Preset LLM providers with OpenAI-compatible endpoints
 */
export const LLM_PROVIDERS = [
  { id: 'custom', name: 'Custom', baseUrl: '' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'zai', name: 'z.ai', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
] as const;

export type LLMProvider = typeof LLM_PROVIDERS[number];

// ============================================================================
// Context Menu Actions
// ============================================================================

/**
 * Context menu action message from background script
 */
export interface ContextMenuAction {
  type: 'context-menu-action';
  action: 'summarize-page' | 'ask-about-page';
  tab: { id: number; title?: string; url?: string };
}

// ============================================================================
// Citation Types
// ============================================================================

/**
 * A cited source with its ID, title, and URL
 */
export interface CitedSource {
  id: number;
  title: string;
  url: string;
}

/**
 * Map of citation IDs (e.g., "[1]", "[2]") to source info
 */
export type CitationMap = Record<string, CitedSource>;
