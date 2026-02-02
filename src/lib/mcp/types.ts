/**
 * MCP (Model Context Protocol) JSON-RPC types
 * Implements JSON-RPC 2.0 for HTTP Streamable transport
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 request object
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 error object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 response object
 */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: T;
  error?: JsonRpcError;
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * MCP tool input schema (JSON Schema)
 */
export interface McpInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * MCP tool definition returned by tools/list
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: McpInputSchema;
}

/**
 * Result of tools/list method
 */
export interface McpListToolsResult {
  tools: McpTool[];
}

/**
 * Content item in tool call result
 */
export interface McpContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/**
 * Result of tools/call method
 */
export interface McpCallToolResult {
  content?: McpContentItem[];
  isError?: boolean;
  // Some servers return result directly
  result?: unknown;
}
