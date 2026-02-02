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
 * Generate a short hash from a string
 * Uses simple FNV-1a hash converted to base36
 */
function shortHash(input: string, length: number = 8): string {
  // FNV-1a hash
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // Keep as 32-bit unsigned
  }
  return hash.toString(36).padStart(length, '0').slice(0, length);
}

/**
 * Maximum tool name length (OpenAI API limit)
 */
const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Get the prefix used for MCP tools from a specific server
 * Format: mcp_{hash8}_
 */
export function getServerPrefix(serverId: string): string {
  return `mcp_${shortHash(serverId)}_`;
}

/**
 * Build a unique tool name that fits within the 64-char limit
 * Format: mcp_{serverHash}_{toolName}
 * If too long, truncates toolName and adds a hash suffix
 */
export function buildMcpToolName(serverId: string, toolName: string): string {
  const prefix = getServerPrefix(serverId);
  const sanitizedToolName = sanitizeToolName(toolName);

  const fullName = `${prefix}${sanitizedToolName}`;

  if (fullName.length <= MAX_TOOL_NAME_LENGTH) {
    return fullName;
  }

  // Need to truncate: prefix + truncated name + '_' + hash4
  const hashSuffix = `_${shortHash(toolName, 4)}`;
  const maxToolNameLength = MAX_TOOL_NAME_LENGTH - prefix.length - hashSuffix.length;
  const truncatedToolName = sanitizedToolName.slice(0, maxToolNameLength);

  return `${prefix}${truncatedToolName}${hashSuffix}`;
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
  return tools.map((mcpTool) => {
    const uniqueName = buildMcpToolName(serverId, mcpTool.name);

    return {
      name: uniqueName,
      description: mcpTool.description || `MCP tool (${mcpTool.name})`,
      source: 'mcp' as const,
      serverId: serverId,
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
