/**
 * ToolRegistry - stores and manages registered tools
 */

import type { Tool, ToolDefinition, MCPServer, ToolRegistryService } from './types';
import { toToolDefinition } from './types';

/**
 * Registry for managing tools available to the agent
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool. Warns if overwriting existing tool.
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(
        `[ToolRegistry] Overwriting existing tool: ${tool.name}`
      );
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions formatted for the LLM API
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(toToolDefinition);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool from the registry
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Remove all tools whose names start with the given prefix
   * @returns Number of tools removed
   */
  unregisterByPrefix(prefix: string): number {
    let count = 0;
    for (const name of this.tools.keys()) {
      if (name.startsWith(prefix)) {
        this.tools.delete(name);
        count++;
      }
    }
    return count;
  }

  /**
   * Get the number of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  // ============================================================================
  // ToolRegistryService implementation for UI
  // ============================================================================

  /**
   * Get all tools with their metadata (implements ToolRegistryService)
   * Returns actual registered tools
   */
  async getTools(): Promise<Tool[]> {
    return this.getAll();
  }

  /**
   * Get MCP servers with their status and tools (implements ToolRegistryService)
   * Groups MCP tools by serverId
   */
  async getServers(): Promise<MCPServer[]> {
    const serverMap = new Map<string, MCPServer>();

    for (const tool of this.tools.values()) {
      if (tool.source === 'mcp' && tool.serverId) {
        let server = serverMap.get(tool.serverId);
        if (!server) {
          server = {
            id: tool.serverId,
            name: tool.serverId, // Will be enhanced when we have server name mapping
            status: 'connected', // If tools exist, server is connected
            tools: [],
          };
          serverMap.set(tool.serverId, server);
        }
        server.tools.push(tool);
      }
    }

    return Array.from(serverMap.values());
  }
}

// ============================================================================
// Mock data for UI development (before real tools are registered)
// ============================================================================

/**
 * Mock built-in tools for UI development
 */
export const MOCK_BUILT_IN_TOOLS: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web via Exa',
    source: 'built-in',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        numResults: { type: 'number', description: 'Number of results (1-10)' },
      },
      required: ['query'],
    },
    execute: async () => 'Mock: Web search not available',
  },
  {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    source: 'built-in',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression to evaluate' },
      },
      required: ['expression'],
    },
    execute: async () => 'Mock: Calculator not available',
  },
];

/**
 * Mock MCP server for UI development
 */
export const MOCK_MCP_SERVERS: MCPServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    status: 'connected',
    tools: [
      {
        name: 'mcp_6qbz7fkv_read_file',
        description: 'Read the contents of a file',
        source: 'mcp',
        serverId: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to read' },
          },
          required: ['path'],
        },
        execute: async () => 'Mock: read_file not available',
      },
      {
        name: 'mcp_6qbz7fkv_write_file',
        description: 'Write content to a file',
        source: 'mcp',
        serverId: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to write' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
        execute: async () => 'Mock: write_file not available',
      },
    ],
  },
];

/**
 * Get mock tools for UI development
 * Call this when no real tools are registered yet
 */
export async function getMockTools(): Promise<Tool[]> {
  const mcpTools = MOCK_MCP_SERVERS.flatMap((server) => server.tools);
  return [...MOCK_BUILT_IN_TOOLS, ...mcpTools];
}

/**
 * Get mock MCP servers for UI development
 */
export async function getMockServers(): Promise<MCPServer[]> {
  return MOCK_MCP_SERVERS;
}
