import type { ChatMessage } from './llm/types';
import type { Message, Settings, CitationMap, CitedSource } from './types';

/**
 * Heuristic token estimation: ~1 token per 4 characters
 */
function estimateTokens(text: string | null): number {
  return text ? Math.ceil(text.length / 4) : 0;
}

/**
 * Build a citation map from tab content system message
 * Parses format: "[N] Title\nSource: URL\nContent..."
 */
function buildCitationMap(tabContentSystemMessage: string | null): CitationMap {
  if (!tabContentSystemMessage) return {};

  const citationMap: CitationMap = {};
  const lines = tabContentSystemMessage.split('\n');
  let currentId: number | null = null;
  let currentTitle: string | null = null;

  for (const line of lines) {
    // Match [N] Title pattern
    const idMatch = line.match(/^\[(\d+)\]\s*(.+)$/);
    if (idMatch) {
      currentId = parseInt(idMatch[1], 10);
      currentTitle = idMatch[2].trim();
      continue;
    }

    // Match Source: URL pattern
    const sourceMatch = line.match(/^Source:\s*(.+)$/i);
    if (sourceMatch && currentId !== null && currentTitle !== null) {
      const url = sourceMatch[1].trim();
      const citationKey = `[${currentId}]`;
      citationMap[citationKey] = {
        id: currentId,
        title: currentTitle,
        url,
      };
      // Reset for next source
      currentId = null;
      currentTitle = null;
    }
  }

  return citationMap;
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
  citationMap: CitationMap;
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

  // 4. Compress old tool results based on age (assistant turns since tool result)
  // Count assistant messages after each position to determine tool result age
  const TOOL_TRUNCATE_LIMIT = 5000;  // chars to keep for recent tool results
  const TOOL_AGE_THRESHOLD = 5;      // assistant turns before full compression

  // Build suffix count of assistant messages from each position to end
  const assistantTurnsAfter: number[] = new Array(messages.length).fill(0);
  let assistantCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    assistantTurnsAfter[i] = assistantCount;
    if (messages[i].role === 'assistant') {
      assistantCount++;
    }
  }

  for (let i = 0; i < historyMessages.length; i++) {
    const msg = historyMessages[i];
    const originalMsg = messages[i];

    if (msg.role !== 'tool') continue;

    const turnsAfter = assistantTurnsAfter[i];
    const originalLength = originalMsg.content.length;

    if (turnsAfter >= TOOL_AGE_THRESHOLD) {
      // Old tool result (5+ assistant turns ago): compress to descriptive marker
      const isError = originalMsg.content.includes('"error"');
      historyMessages[i] = {
        ...msg,
        content: `[Tool result from ${msg.name || 'unknown'}: ${isError ? 'error' : 'success'}, ${originalLength.toLocaleString()} chars. Content compressed — the assistant already processed this result. Re-call the tool if you need the original data.]`,
      };
    } else if (turnsAfter > 0 && originalLength > TOOL_TRUNCATE_LIMIT) {
      // Recent but large tool result: truncate to 5000 chars
      historyMessages[i] = {
        ...msg,
        content: originalMsg.content.slice(0, TOOL_TRUNCATE_LIMIT) +
          `\n\n... [truncated, originally ${originalLength.toLocaleString()} chars. Call the tool again if you need the full result.]`,
      };
    }
    // turnsAfter === 0 (no assistant response yet): keep verbatim
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

  // Build citation map from tab content
  const citationMap = buildCitationMap(tabContentSystemMessage);

  return {
    apiMessages,
    totalEstimatedTokens,
    historyTrimmed,
    citationMap,
  };
}

export { estimateTokens };
