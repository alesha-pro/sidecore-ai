// src/lib/streaming/tool-parser.ts

import type { ToolCall } from '../llm/types';
import type { StreamingToolCallDelta } from './streaming-types';

/**
 * Stateful parser for reconstructing tool calls from streaming deltas.
 *
 * OpenAI streaming sends tool calls incrementally:
 * 1. First delta has: index, id, type, function.name
 * 2. Subsequent deltas have: index, function.arguments (chunks)
 *
 * This parser accumulates these deltas and provides complete ToolCall objects.
 */
export class ToolCallParser {
  /**
   * Map from tool call index to accumulated tool call data.
   * Index is the position in the tool_calls array.
   */
  private currentToolCalls: Map<
    number,
    {
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }
  > = new Map();

  /**
   * Process an array of tool call deltas from a streaming chunk.
   * Call this for each chunk that contains tool_calls in its delta.
   *
   * @param deltas Array of StreamingToolCallDelta from a single chunk
   */
  addDelta(deltas: StreamingToolCallDelta[]): void {
    for (const delta of deltas) {
      const { index, id, type, function: fn } = delta;

      // Get or create entry for this index
      let existing = this.currentToolCalls.get(index);

      if (!existing) {
        // First delta for this tool call - initialize with empty values
        existing = {
          id: '',
          type: 'function',
          function: {
            name: '',
            arguments: '',
          },
        };
        this.currentToolCalls.set(index, existing);
      }

      // Update fields if present in delta
      if (id !== undefined) {
        existing.id = id;
      }

      if (type !== undefined) {
        existing.type = type;
      }

      if (fn?.name !== undefined) {
        existing.function.name = fn.name;
      }

      if (fn?.arguments !== undefined) {
        // Append arguments (they're streamed in chunks)
        existing.function.arguments += fn.arguments;
      }
    }
  }

  /**
   * Get all accumulated tool calls.
   * Returns ToolCall objects in index order.
   *
   * Note: This doesn't validate that arguments are valid JSON.
   * Validation happens during tool execution.
   *
   * @returns Array of ToolCall objects
   */
  getToolCalls(): ToolCall[] {
    const result: ToolCall[] = [];

    // Sort by index to maintain order
    const indices = Array.from(this.currentToolCalls.keys()).sort(
      (a, b) => a - b
    );

    for (const index of indices) {
      const tc = this.currentToolCalls.get(index)!;
      result.push({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      });
    }

    return result;
  }

  /**
   * Check if any tool calls have been accumulated.
   */
  hasToolCalls(): boolean {
    return this.currentToolCalls.size > 0;
  }

  /**
   * Reset the parser state.
   * Call this when starting a new streaming response.
   */
  reset(): void {
    this.currentToolCalls.clear();
  }
}
