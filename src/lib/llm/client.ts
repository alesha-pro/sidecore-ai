/**
 * LLM API client functions for OpenAI-compatible endpoints
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  Model,
  ModelsResponse,
} from './types';
import { LLMError, createLLMError, createNetworkError } from './errors';

const LIST_MODELS_TIMEOUT_MS = 10000;
const COMPLETION_TIMEOUT_MS = 60000;

/**
 * Check host permission for a URL (non-blocking, best-effort)
 */
async function checkHostPermission(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const originPattern = `${parsed.protocol}//${parsed.host}/*`;
    const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
    if (!hasPermission) {
      throw new LLMError(
        `No permission to access ${parsed.host}. Grant access to this domain in the permission prompt.`,
        403,
        'permission_denied',
        { origin: originPattern }
      );
    }
  } catch (e) {
    if (e instanceof LLMError) throw e;
    // Ignore URL parse or API availability issues
  }
}

/**
 * Fetch wrapper with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build headers for API requests
 */
function getHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * List available models from the LLM provider
 * @param baseUrl - Base URL (e.g., "https://api.openai.com/v1")
 * @param apiKey - API key for authentication
 * @returns Array of models sorted alphabetically by id
 */
export async function listModels(
  baseUrl: string,
  apiKey: string
): Promise<Model[]> {
  try {
    await checkHostPermission(`${baseUrl}/models`);
    const response = await fetchWithTimeout(
      `${baseUrl}/models`,
      {
        method: 'GET',
        headers: getHeaders(apiKey),
      },
      LIST_MODELS_TIMEOUT_MS
    );

    if (!response.ok) {
      throw await createLLMError(response);
    }

    const data: ModelsResponse = await response.json();

    // Sort models alphabetically for consistent UI
    return data.data.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw createNetworkError(error as Error);
  }
}

/**
 * Create a chat completion (non-streaming)
 * @param baseUrl - Base URL (e.g., "https://api.openai.com/v1")
 * @param apiKey - API key for authentication
 * @param request - Chat completion request parameters
 * @returns Chat completion response
 */
export async function createChatCompletion(
  baseUrl: string,
  apiKey: string,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    await checkHostPermission(`${baseUrl}/chat/completions`);
    const response = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify({ ...request, stream: false }),
      },
      COMPLETION_TIMEOUT_MS
    );

    if (!response.ok) {
      throw await createLLMError(response);
    }

    return response.json();
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw createNetworkError(error as Error);
  }
}
