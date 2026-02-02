/**
 * Agent loop orchestrator with iteration and timeout guards
 * Executes tool calls automatically when Agent Mode is enabled
 */

import { createStreamingClient } from '../streaming/streaming-client';
import type { StreamingToolCallDelta } from '../streaming/streaming-types';
import type { ChatMessage, ToolCall } from '../llm/types';
import type { ToolDefinition } from '../tools/types';

/**
 * Callback for executing a tool
 * @param name - Tool name
 * @param args - Parsed arguments from JSON
 * @param signal - AbortSignal for cancellation
 * @returns Tool execution result
 */
export type ExecuteToolCallback = (
  name: string,
  args: unknown,
  signal?: AbortSignal
) => Promise<unknown>;

/**
 * Callbacks for streaming agent loop events
 */
export interface AgentLoopCallbacks {
  /** Called for each content chunk from the LLM */
  onContentDelta?: (content: string) => void;
  /** Called for each tool call delta from the LLM */
  onToolCallDelta?: (delta: StreamingToolCallDelta) => void;
  /** Called when a new LLM iteration starts */
  onIterationStart?: (iteration: number) => void;
  /** Called after each tool execution completes */
  onToolResult?: (toolCallId: string, name: string, result: unknown) => void;
}

/**
 * Configuration for the agent loop
 */
export interface AgentLoopConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  executeTool: ExecuteToolCallback;
  maxIterations: number;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Optional callbacks for streaming updates */
  callbacks?: AgentLoopCallbacks;
}

/**
 * Result of the agent loop
 */
export interface AgentLoopResult {
  /** Final assistant message (no tool calls) */
  finalMessage: ChatMessage & { reasoning_content?: string };
  /** Full message history including tool messages */
  messages: ChatMessage[];
}

/**
 * Run the agentic loop with automatic tool execution
 *
 * The loop continues until:
 * - The model returns a message with no tool_calls (success)
 * - Max iterations reached (throws error)
 * - Timeout exceeded (throws error)
 * - AbortSignal triggered (throws DOMException)
 *
 * @param config - Loop configuration
 * @returns Final message and full message history
 * @throws Error if max iterations or timeout exceeded
 * @throws DOMException if aborted via signal
 */
export async function runAgentLoop(
  config: AgentLoopConfig
): Promise<AgentLoopResult> {
  const {
    baseUrl,
    apiKey,
    model,
    messages: initialMessages,
    tools,
    executeTool,
    maxIterations,
    timeoutMs,
    signal,
    callbacks,
  } = config;

  // Clone messages to avoid mutating the original array
  const messages: ChatMessage[] = [...initialMessages];
  const deadline = Date.now() + timeoutMs;
  let iterations = 0;

  while (iterations < maxIterations) {
    // Check timeout
    if (Date.now() >= deadline) {
      throw new Error('Agent loop timed out');
    }

    // Check abort signal
    if (signal?.aborted) {
      throw new DOMException('Agent loop aborted', 'AbortError');
    }

    // Notify iteration start
    callbacks?.onIterationStart?.(iterations);

    // Stream LLM response with tools
    const streamUrl = `${baseUrl}/chat/completions`;
    const generator = createStreamingClient(streamUrl, {
      apiKey,
      body: {
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      },
      signal,
    });

    // Accumulate response from stream
    let accumulatedContent = '';
    let accumulatedReasoningContent = '';
    const toolCallsMap = new Map<number, ToolCall>();

    for await (const chunk of generator) {
      // Check abort signal during streaming
      if (signal?.aborted) {
        throw new DOMException('Agent loop aborted', 'AbortError');
      }

      if (chunk.type === 'data' && typeof chunk.payload === 'object' && 'choices' in chunk.payload) {
        const delta = (chunk.payload as { choices: Array<{ delta: { content?: string; reasoning_content?: string; tool_calls?: StreamingToolCallDelta[] } }> }).choices[0]?.delta;
        if (!delta) continue;

        // Accumulate content
        if (delta.content) {
          accumulatedContent += delta.content;
          callbacks?.onContentDelta?.(delta.content);
        }

        // Accumulate reasoning content (DeepSeek)
        if (delta.reasoning_content) {
          accumulatedReasoningContent += delta.reasoning_content;
        }

        // Accumulate tool calls (index-based)
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          for (const tcDelta of delta.tool_calls) {
            const index = tcDelta.index;
            const existing = toolCallsMap.get(index);

            if (existing) {
              // Append to existing tool call arguments
              if (tcDelta.function?.arguments) {
                toolCallsMap.set(index, {
                  ...existing,
                  function: {
                    ...existing.function,
                    arguments: existing.function.arguments + tcDelta.function.arguments,
                  },
                });
              }
            } else {
              // Create new tool call
              toolCallsMap.set(index, {
                id: tcDelta.id || '',
                type: 'function',
                function: {
                  name: tcDelta.function?.name || '',
                  arguments: tcDelta.function?.arguments || '',
                },
              });
            }

            // Emit delta to callback
            callbacks?.onToolCallDelta?.(tcDelta);
          }
        }
      } else if (chunk.type === 'error') {
        const errorMessage = typeof chunk.payload === 'object' && 'message' in chunk.payload
          ? (chunk.payload as { message: string }).message
          : 'Streaming error in agent loop';
        throw new Error(errorMessage);
      }
    }

    // Build assistant message from accumulated data
    const toolCalls = Array.from(toolCallsMap.values());
    const assistantMessage: ChatMessage & { reasoning_content?: string } = {
      role: 'assistant',
      content: accumulatedContent || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      reasoning_content: accumulatedReasoningContent || undefined,
    };

    // Append assistant message to history
    messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        finalMessage: assistantMessage,
        messages,
      };
    }

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      // Check abort signal before each tool execution
      if (signal?.aborted) {
        throw new DOMException('Agent loop aborted', 'AbortError');
      }

      // Check timeout before each tool execution
      if (Date.now() >= deadline) {
        throw new Error('Agent loop timed out');
      }

      const result = await executeToolCall(toolCall, executeTool, signal);

      // Notify tool result
      callbacks?.onToolResult?.(toolCall.id, toolCall.function.name, result);

      // Append tool result message
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    iterations++;
  }

  // Max iterations reached
  throw new Error('Agent loop exceeded max iterations');
}

/**
 * Execute a single tool call and return the result
 */
async function executeToolCall(
  toolCall: ToolCall,
  executeTool: ExecuteToolCallback,
  signal?: AbortSignal
): Promise<unknown> {
  const { name, arguments: argsString } = toolCall.function;

  // Parse arguments
  let args: unknown;
  try {
    args = JSON.parse(argsString);
  } catch (parseError) {
    return {
      error: 'Invalid JSON in tool arguments',
      details: parseError instanceof Error ? parseError.message : String(parseError),
    };
  }

  // Execute the tool
  try {
    return await executeTool(name, args, signal);
  } catch (execError) {
    return {
      error: 'Tool execution failed',
      name,
      details: execError instanceof Error ? execError.message : String(execError),
    };
  }
}
