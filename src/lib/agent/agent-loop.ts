/**
 * Agent loop orchestrator with iteration and timeout guards
 * Executes tool calls automatically when Agent Mode is enabled
 */

import { createChatCompletion } from '../llm/client';
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

    // Call LLM with tools
    const response = await createChatCompletion(baseUrl, apiKey, {
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    });

    const assistantMessage = response.choices[0].message;
    const reasoningContent = response.choices[0].message.reasoning_content;

    // Append assistant message to history
    messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        finalMessage: {
          ...assistantMessage,
          reasoning_content: reasoningContent,
        },
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
