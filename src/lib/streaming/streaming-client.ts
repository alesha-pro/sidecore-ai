// src/lib/streaming/streaming-client.ts
import { StreamingChunkType, StreamingMessageType } from './streaming-types';

/**
 * Creates an async generator to receive Server-Sent Events (SSE) from a given URL.
 *
 * @param url The URL of the SSE endpoint.
 * @param signal An AbortSignal to cancel the streaming connection.
 * @returns An AsyncGenerator that yields StreamingChunkType objects.
 */
export async function* createStreamingClient(
  url: string,
  signal?: AbortSignal
): AsyncGenerator<StreamingChunkType> {
  let eventSource: EventSource | null = null;
  const abortController = new AbortController();

  // If an external signal is provided, link it to the internal controller
  if (signal) {
    signal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  try {
    eventSource = new EventSource(url);

    // Close the EventSource if the abort signal is triggered
    abortController.signal.addEventListener('abort', () => {
      eventSource?.close();
    }, { once: true });

    // Yield data chunks as they arrive
    const messageQueue: StreamingChunkType[] = [];
    let resolveMessage: ((value?: StreamingChunkType) => void) | null = null;

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        messageQueue.push({ type: 'data', payload });
      } catch (e) {
        // If data is not JSON, treat it as a raw string payload
        messageQueue.push({ type: 'data', payload: event.data });
      }
      if (resolveMessage) {
        resolveMessage(messageQueue.shift());
        resolveMessage = null;
      }
    };

    eventSource.onerror = (error: Event) => {
      console.error('SSE EventSource error:', error);
      // Yield an error chunk and then complete the generator
      if (resolveMessage) {
        resolveMessage({ type: 'error', payload: { message: 'Connection error', error } });
        resolveMessage = null;
      } else {
        messageQueue.push({ type: 'error', payload: { message: 'Connection error', error } });
      }
      abortController.abort(); // Terminate the stream on error
    };

    // Keep the generator open until aborted or EventSource closes naturally
    while (!abortController.signal.aborted) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        // Wait for a new message or abort signal
        await new Promise<void | StreamingChunkType>(resolve => {
          resolveMessage = resolve;
          abortController.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      }
    }

    // After the loop, send a 'complete' message if not due to error
    if (!abortController.signal.aborted) {
        yield { type: 'complete', payload: { message: 'Streaming complete' } };
    }

  } catch (e) {
    console.error('Failed to establish SSE connection:', e);
    yield { type: 'error', payload: { message: 'Failed to establish connection', error: e } };
  } finally {
    // Ensure EventSource is closed if it was opened
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
      eventSource.close();
    }
  }
}
