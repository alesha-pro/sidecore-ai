// src/lib/streaming/streaming-types.ts

import type { ToolCall } from '../llm/types';

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

/**
 * Delta for a tool call in streaming response.
 * Tool calls arrive incrementally - id/name come first, then arguments are streamed.
 * The `index` field identifies which tool call in the array this delta belongs to.
 */
export interface StreamingToolCallDelta {
  /** Index of this tool call in the tool_calls array */
  index: number;
  /** Tool call ID (only present in first delta for this index) */
  id?: string;
  /** Always 'function' when present */
  type?: 'function';
  /** Function details (name comes first, arguments stream incrementally) */
  function?: {
    /** Function name (only present in first delta) */
    name?: string;
    /** Arguments chunk (streamed incrementally, must be concatenated) */
    arguments?: string;
  };
}

/**
 * Delta content in a streaming chat completion choice.
 * Matches OpenAI streaming format for delta content.
 */
export interface ChatCompletionStreamDelta {
  role?: 'assistant';
  content?: string | null;
  /** Tool calls being made (streamed incrementally) */
  tool_calls?: StreamingToolCallDelta[];
  /** DeepSeek reasoning content */
  reasoning_content?: string;
}

/**
 * A single choice in a streaming chat completion chunk.
 */
export interface ChatCompletionStreamChoice {
  index: number;
  delta: ChatCompletionStreamDelta;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/**
 * Full streaming chunk from OpenAI-compatible API.
 * This is the parsed JSON from `data:` lines in SSE.
 */
export interface ChatCompletionStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionStreamChoice[];
}
