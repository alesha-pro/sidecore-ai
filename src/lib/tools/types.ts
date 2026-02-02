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
 * Source of a tool - where it comes from
 */
export type ToolSource = 'built-in' | 'mcp';

/**
 * Core Tool interface for registered tools
 * @template TParams - The type of parameters the tool accepts
 */
export interface Tool<TParams = unknown> {
  /** Unique identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema defining the tool's parameters (alias: inputSchema) */
  parameters: JSONSchema;
  /** Execute the tool with the given arguments */
  execute: (args: TParams) => Promise<unknown>;
  /** Source of the tool */
  source: ToolSource;
  /** Server ID if tool comes from MCP server */
  serverId?: string;
}

/**
 * Tool input schema - alias for parameters for clarity in UI contexts
 */
export type ToolInputSchema = JSONSchema;

/**
 * MCP Server runtime status
 */
export type MCPServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * MCP Server runtime state (different from McpServerConfig which is for storage)
 */
export interface MCPServer {
  /** Server identifier (matches McpServerConfig.id) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Current connection status */
  status: MCPServerStatus;
  /** Tools provided by this server */
  tools: Tool[];
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Service interface for accessing tools and servers
 */
export interface ToolRegistryService {
  /** Get all registered tools */
  getTools(): Promise<Tool[]>;
  /** Get all MCP servers with their status */
  getServers(): Promise<MCPServer[]>;
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
