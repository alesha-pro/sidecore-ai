// src/lib/streaming/streaming-client.ts
import { StreamingChunkType } from './streaming-types';
import { createLLMError } from '../llm/errors';

/**
 * Creates an async generator to receive Server-Sent Events (SSE) from a given URL.
 *
 * @param url The URL of the SSE endpoint.
 * @param options Request options including API key, body, and abort signal.
 * @returns An AsyncGenerator that yields StreamingChunkType objects.
 */
export async function* createStreamingClient(
  url: string,
  options: {
    apiKey: string;
    body: Record<string, unknown>;
    signal?: AbortSignal;
  }
): AsyncGenerator<StreamingChunkType> {
  const { apiKey, body, signal } = options;

  // Check host permission before streaming request
  try {
    const parsed = new URL(url);
    const originPattern = `${parsed.protocol}//${parsed.host}/*`;
    const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
    if (!hasPermission) {
      yield { type: 'error', payload: { message: `No permission to access ${parsed.host}. Grant access to this domain in the permission prompt.` } };
      return;
    }
  } catch {
    // Ignore URL parse or API availability issues
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });

    if (!response.ok) {
      const error = await createLLMError(response);
      console.error(error.toLogString());
      yield { type: 'error', payload: { message: error.userMessage } };
      return;
    }

    if (!response.body) {
      yield { type: 'error', payload: { message: 'Streaming response has no body.' } };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          yield { type: 'complete', payload: { message: 'Streaming complete' } };
          return;
        }

        try {
          const payload = JSON.parse(data) as Record<string, unknown>;
          yield { type: 'data', payload };
        } catch (error) {
          console.error('Failed to parse streaming data:', error);
          yield { type: 'error', payload: { message: 'Failed to parse streaming response.' } };
          return;
        }
      }
    }

    yield { type: 'complete', payload: { message: 'Streaming complete' } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    console.error('Failed to establish streaming connection:', error);
    yield { type: 'error', payload: { message: 'Failed to establish connection.' } };
  }
}
