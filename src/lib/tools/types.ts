/**
 * Tool types for the Agentic Tool system
 * Matches OpenAI function calling specification
 */

/**
 * JSON Schema representation for tool parameters
 */
export interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, JSONSchema & { description?: string }>;
  required?: string[];
  items?: JSONSchema;
  enum?: string[];
  description?: string;
}

/**
 * Core Tool interface for registered tools
 * @template TParams - The type of parameters the tool accepts
 */
export interface Tool<TParams = unknown> {
  /** Unique identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema defining the tool's parameters */
  parameters: JSONSchema;
  /** Execute the tool with the given arguments */
  execute: (args: TParams) => Promise<unknown>;
}

/**
 * Tool definition sent to OpenAI API (excludes execute function)
 * Format: { type: 'function', function: { name, description, parameters } }
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

/**
 * Convert a Tool to a ToolDefinition for the LLM API
 */
export function toToolDefinition(tool: Tool): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
