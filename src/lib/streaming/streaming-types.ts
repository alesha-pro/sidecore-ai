// src/lib/streaming/streaming-types.ts

/**
 * Defines the possible types of streaming messages.
 */
export type StreamingMessageType = 'data' | 'error' | 'complete';

/**
 * Represents a single chunk of streaming data received from the SSE endpoint.
 * The payload's structure will depend on the message type.
 */
export interface StreamingChunkType {
  type: StreamingMessageType;
  // Payload can be a string (e.g., raw text chunk) or an object (e.g., structured error/completion info)
  payload: string | Record<string, any>;
}
