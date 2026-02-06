import type { Settings } from './types';
import { createChatCompletion } from './llm/client';

/**
 * Generate follow-up suggestions using a small LLM.
 * Uses the same provider config as title generation.
 * Returns empty array on any error.
 */
export async function generateSuggestions(
  settings: Settings,
  userMessage: string,
  assistantMessage: string
): Promise<string[]> {
  // Use title-gen provider (small model) or fall back to main provider
  const baseUrl = settings.titleGenUseSameProvider
    ? settings.baseUrl
    : settings.titleGenBaseUrl;
  const apiKey = settings.titleGenUseSameProvider
    ? settings.apiKey
    : settings.titleGenApiKey;
  const model = settings.titleGenModel || settings.defaultModel;

  if (!baseUrl || !apiKey || !model) {
    return [];
  }

  try {
    const response = await createChatCompletion(baseUrl, apiKey, {
      model,
      messages: [
        {
          role: 'system',
          content: 'You suggest follow-up questions. Given a conversation snippet, output 1-3 short follow-up questions the user might ask next. Each question on its own line, no numbering, no bullets, no explanation. Questions should be specific, actionable, and under 60 characters.',
        },
        {
          role: 'user',
          content: `User asked: How do I center a div in CSS?\nAssistant answered: You can use flexbox with display: flex, justify-content: center, and align-items: center on the parent container.`,
        },
        {
          role: 'assistant',
          content: 'How does CSS Grid centering compare?\nCan I center vertically only?\nWhat about older browser support?',
        },
        {
          role: 'user',
          content: `User asked: ${userMessage.slice(0, 300)}\nAssistant answered: ${assistantMessage.slice(0, 500)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) return [];

    const suggestions = raw
      .split('\n')
      .map(line => line.replace(/^\d+[.)]\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0 && line.length <= 80)
      .slice(0, 3);

    return suggestions;
  } catch (error) {
    console.error('[suggestion-generator] Failed to generate suggestions:', error);
    return [];
  }
}
