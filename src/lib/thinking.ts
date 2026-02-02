/**
 * Thinking/reasoning content extraction utilities
 *
 * Handles multiple LLM formats:
 * - Claude: <thinking>...</thinking> tags
 * - DeepSeek: <think>...</think> tags or reasoning_content field
 */

export interface ThinkingContent {
  thinking: string | null;
  mainContent: string;
}

/**
 * Extract thinking/reasoning content from LLM response
 *
 * Priority order:
 * 1. reasoningField (DeepSeek reasoning_content from API)
 * 2. <thinking>...</thinking> tags (Claude format)
 * 3. <think>...</think> tags (DeepSeek format)
 *
 * @param content - The raw response content
 * @param reasoningField - Optional reasoning_content field from API response
 * @returns ThinkingContent with extracted thinking and cleaned mainContent
 */
export function extractThinking(
  content: string,
  reasoningField?: string
): ThinkingContent {
  // Priority 1: Use reasoning field if provided (DeepSeek API)
  if (reasoningField) {
    return {
      thinking: reasoningField,
      mainContent: content,
    };
  }

  // Priority 2: Extract <thinking>...</thinking> (Claude format)
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/;
  const thinkingMatch = content.match(thinkingRegex);
  if (thinkingMatch) {
    return {
      thinking: thinkingMatch[1].trim(),
      mainContent: content.replace(thinkingRegex, '').trim(),
    };
  }

  // Priority 3: Extract <think>...</think> (DeepSeek format)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  const thinkMatch = content.match(thinkRegex);
  if (thinkMatch) {
    return {
      thinking: thinkMatch[1].trim(),
      mainContent: content.replace(thinkRegex, '').trim(),
    };
  }

  // No thinking content found
  return {
    thinking: null,
    mainContent: content,
  };
}
