/**
 * TypeScript interfaces for OpenAI-compatible API
 */

import type { ToolDefinition } from '../tools/types';

/**
 * Tool call made by the model
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON-encoded arguments */
    arguments: string;
  };
}

/**
 * Chat message for request (extends to include tool-related fields)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Tool calls made by assistant (only for role: 'assistant') */
  tool_calls?: ToolCall[];
  /** ID of the tool call this message is responding to (only for role: 'tool') */
  tool_call_id?: string;
  /** Name of the tool (for role: 'tool') */
  name?: string;
}

/**
 * Tool choice for the request
 * - 'auto': Model decides whether to call tools
 * - 'none': Model will not call any tool
 * - 'required': Model must call at least one tool
 * - { type: 'function', function: { name: string } }: Force specific tool
 */
export type ToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } };

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  /** Tools available for the model to call */
  tools?: ToolDefinition[];
  /** Control tool calling behavior */
  tool_choice?: ToolChoice;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage & {
    reasoning_content?: string; // DeepSeek reasoning model field
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface Model {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: 'list';
  data: Model[];
}
