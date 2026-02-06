import type { Settings } from './types';
import { createChatCompletion } from './llm/client';

/**
 * Generate a chat title using LLM.
 * Returns null on any error (caller should fall back to truncation).
 */
export async function generateTitle(
  settings: Settings,
  userMessage: string,
  assistantMessage: string
): Promise<string | null> {
  // Resolve provider: use main provider or separate title-gen provider
  const baseUrl = settings.titleGenUseSameProvider
    ? settings.baseUrl
    : settings.titleGenBaseUrl;
  const apiKey = settings.titleGenUseSameProvider
    ? settings.apiKey
    : settings.titleGenApiKey;
  const model = settings.titleGenModel || settings.defaultModel;

  if (!baseUrl || !apiKey || !model) {
    return null;
  }

  try {
    const response = await createChatCompletion(baseUrl, apiKey, {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a title generator. Given a conversation snippet, output a single concise descriptive title (4-8 words) that captures the specific topic. Be specific, not generic. Output only the title on one line, no quotes, no explanation.',
        },
        {
          role: 'user',
          content: `Question: How do I center a div in CSS?\nAnswer: You can use flexbox with display: flex, justify-content: center, and align-items: center on the parent container.`,
        },
        {
          role: 'assistant',
          content: 'Centering a Div With CSS Flexbox',
        },
        {
          role: 'user',
          content: `Question: ${userMessage.slice(0, 300)}\nAnswer: ${assistantMessage.slice(0, 500)}`,
        },
      ],
      temperature: 0.7,
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) return null;

    // Clean up: remove quotes, trim, take first line only, cap at 50 chars
    const cleaned = raw
      .split('\n')[0]
      .replace(/^["'`*]+|["'`*]+$/g, '')
      .replace(/^title:\s*/i, '')
      .replace(/\.+$/, '')
      .trim();

    if (!cleaned || cleaned.length < 2) return null;

    return cleaned.length > 50 ? cleaned.slice(0, 50) : cleaned;
  } catch (error) {
    console.error('[title-generator] Failed to generate title:', error);
    return null;
  }
}
