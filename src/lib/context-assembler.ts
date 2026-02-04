import type { ChatMessage } from './llm/types';
import type { Message, Settings } from './types';

/**
 * Heuristic token estimation: ~1 token per 4 characters
 */
function estimateTokens(text: string | null): number {
  return text ? Math.ceil(text.length / 4) : 0;
}

/**
 * Estimate tokens for a single ChatMessage including tool calls
 */
function estimateMessageTokens(msg: ChatMessage): number {
  let tokens = estimateTokens(msg.content);

  // Tool calls have JSON arguments
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += estimateTokens(tc.function.name);
      tokens += estimateTokens(tc.function.arguments);
    }
  }

  // Per-message overhead (role, separators, formatting)
  tokens += 4;

  return tokens;
}

export interface AssembleOptions {
  messages: Message[];
  userContent: string;
  systemPrompt: string;           // Already-built system prompt (with language instruction + datetime)
  tabContentSystemMessage: string | null; // Extracted tab content (null if none)
  modelContextLimit: number;      // from settings.modelContextLimit
}

export interface AssembleResult {
  apiMessages: ChatMessage[];
  totalEstimatedTokens: number;
  historyTrimmed: boolean;
}

/**
 * Assemble context for LLM API call with smart context management:
 * - Compresses old tool results that have been consumed by assistant
 * - Trims history to fit within model context limit
 * - Preserves system messages, recent messages, and content injection points
 */
export function assembleContext(options: AssembleOptions): AssembleResult {
  const { messages, userContent, systemPrompt, tabContentSystemMessage, modelContextLimit } = options;

  // 1. Build fixed messages (always included)
  const fixedMessages: ChatMessage[] = [];

  // System prompt (if non-empty)
  if (systemPrompt.trim()) {
    fixedMessages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // Tab content from current extraction (if any)
  if (tabContentSystemMessage) {
    fixedMessages.push({
      role: 'system',
      content: tabContentSystemMessage,
    });
  }

  // 2. Build current turn
  const currentTurn: ChatMessage = {
    role: 'user',
    content: userContent,
  };

  // 3. Convert message history to ChatMessage format
  const historyMessages: ChatMessage[] = messages.map((msg) => {
    const apiMsg: ChatMessage = {
      role: msg.role,
      content: msg.content,
    };

    // Convert contentMessageId messages to system role for API
    if (msg.contentMessageId) {
      apiMsg.role = 'system';
    }

    // Include tool_calls for assistant messages
    if (msg.role === 'assistant' && msg.tool_calls) {
      apiMsg.tool_calls = msg.tool_calls;
    }

    // Include tool_call_id and name for tool messages
    if (msg.role === 'tool') {
      if (msg.tool_call_id) {
        apiMsg.tool_call_id = msg.tool_call_id;
      }
      if (msg.name) {
        apiMsg.name = msg.name;
      }
    }

    return apiMsg;
  });

  // 4. Compress old tool results
  // Find the last assistant message index to determine which tool results are "consumed"
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  // Compress tool messages that appear before the last assistant message
  for (let i = 0; i < historyMessages.length; i++) {
    const msg = historyMessages[i];
    const originalMsg = messages[i];

    if (msg.role === 'tool' && i < lastAssistantIndex) {
      // This tool result has been consumed by a subsequent assistant message
      const isError = originalMsg.content.includes('"error":');
      const compressedContent = JSON.stringify({
        tool: msg.name || 'unknown',
        status: isError ? 'error' : 'ok',
        chars: originalMsg.content.length,
      });

      historyMessages[i] = {
        ...msg,
        content: compressedContent,
      };
    }
  }

  // 5. Token-aware trimming
  const targetLimit = Math.floor(modelContextLimit * 0.85); // Leave 15% for response

  // Calculate tokens for fixed messages and current turn
  const fixedTokens = fixedMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  const currentTurnTokens = estimateMessageTokens(currentTurn);
  const availableForHistory = targetLimit - fixedTokens - currentTurnTokens;

  // Track which messages are protected from trimming
  const protectedIndices = new Set<number>();

  // Protect the last 6 messages for conversational coherence
  const protectCount = Math.min(6, historyMessages.length);
  for (let i = historyMessages.length - protectCount; i < historyMessages.length; i++) {
    protectedIndices.add(i);
  }

  // Protect messages with contentMessageId (tab content injection points)
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].contentMessageId) {
      protectedIndices.add(i);
    }
  }

  // Calculate history tokens and trim if needed
  let historyTokens = historyMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  let historyTrimmed = false;
  let trimmedHistory = [...historyMessages];

  if (historyTokens > availableForHistory) {
    historyTrimmed = true;

    // Remove oldest non-protected messages until under budget
    const mutableHistory = [...historyMessages];
    for (let i = 0; i < mutableHistory.length; i++) {
      if (protectedIndices.has(i)) {
        continue; // Skip protected messages
      }

      // Check if removing this message brings us under budget
      const msgTokens = estimateMessageTokens(mutableHistory[i]);
      historyTokens -= msgTokens;

      if (historyTokens <= availableForHistory) {
        // Found the trim point - keep messages from i+1 onwards
        trimmedHistory = mutableHistory.slice(i + 1);
        break;
      }
    }
  }

  // 6. Assemble final message array
  const apiMessages = [
    ...fixedMessages,
    ...trimmedHistory,
    currentTurn,
  ];

  const totalEstimatedTokens = apiMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

  return {
    apiMessages,
    totalEstimatedTokens,
    historyTrimmed,
  };
}

export { estimateTokens };
