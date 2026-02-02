/**
 * MCP tool adapter
 * Converts MCP tools into the Tool registry format
 */

import type { Tool, JSONSchema } from '../tools/types';
import type { McpTool, McpCallToolResult, McpContentItem } from './types';
import type { McpClient } from './client';

/**
 * Sanitize a tool name to only contain valid characters [a-zA-Z0-9_-]
 * Replaces invalid characters with underscores
 */
export function sanitizeToolName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Extract text content from MCP tool result
 */
function extractResultContent(result: McpCallToolResult): string {
  // If result has content array, extract text items
  if (result.content && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((item: McpContentItem) => item.type === 'text' && item.text)
      .map((item: McpContentItem) => item.text as string);

    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    // If no text content, stringify the whole content
    return JSON.stringify(result.content);
  }

  // If result has direct result field
  if (result.result !== undefined) {
    return typeof result.result === 'string'
      ? result.result
      : JSON.stringify(result.result);
  }

  // Fallback: stringify the whole result
  return JSON.stringify(result);
}

/**
 * Build Tool registry entries from MCP tools
 *
 * @param serverId - Unique identifier for the MCP server (used in tool names)
 * @param tools - MCP tools from listTools()
 * @param client - McpClient instance for executing tools
 * @returns Array of Tool objects ready for the tool registry
 */
export function buildMcpTools(
  serverId: string,
  tools: McpTool[],
  client: McpClient
): Tool[] {
  const sanitizedServerId = sanitizeToolName(serverId);

  return tools.map((mcpTool) => {
    const sanitizedToolName = sanitizeToolName(mcpTool.name);
    const uniqueName = `mcp_${sanitizedServerId}__${sanitizedToolName}`;

    return {
      name: uniqueName,
      description: mcpTool.description || `MCP tool (${mcpTool.name})`,
      parameters: mcpTool.inputSchema as JSONSchema,
      execute: async (args: unknown): Promise<string> => {
        const result = await client.callTool(mcpTool.name, args);

        // Check for error flag
        if (result.isError) {
          const errorContent = extractResultContent(result);
          throw new Error(`MCP tool error: ${errorContent}`);
        }

        return extractResultContent(result);
      },
    };
  });
}
