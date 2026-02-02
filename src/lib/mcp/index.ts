/**
 * MCP (Model Context Protocol) module
 * Provides HTTP client and tool adapter for MCP server integration
 */

// Types
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  McpTool,
  McpInputSchema,
  McpListToolsResult,
  McpCallToolResult,
  McpContentItem,
} from './types';

// Client
export { McpClient } from './client';

// Adapter
export { sanitizeToolName, buildMcpTools } from './tool-adapter';
