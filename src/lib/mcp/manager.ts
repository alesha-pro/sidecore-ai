/**
 * MCP Tool Manager
 * Syncs MCP server tools into the ToolRegistry
 */

import type { ToolRegistry } from '../tools/registry';
import type { McpServerConfig } from '../types';
import { McpClient } from './client';
import { buildMcpTools, getServerPrefix } from './tool-adapter';

/**
 * Manages MCP server tool registration and cleanup
 */
export class McpToolManager {
  private activeServerIds: Set<string> = new Set();

  constructor(private readonly registry: ToolRegistry) {}

  /**
   * Sync MCP tools with the registry
   * - Removes tools from servers that are no longer in the list
   * - Adds tools from new servers
   */
  async sync(servers: McpServerConfig[]): Promise<void> {
    const currentServerIds = new Set(servers.map((s) => s.id));

    // Remove tools from servers that are no longer configured
    for (const serverId of this.activeServerIds) {
      if (!currentServerIds.has(serverId)) {
        const prefix = getServerPrefix(serverId);
        const removed = this.registry.unregisterByPrefix(prefix);
        console.log(`[McpToolManager] Removed ${removed} tools from server ${serverId}`);
      }
    }

    // Add tools from new servers
    for (const server of servers) {
      if (!this.activeServerIds.has(server.id)) {
        await this.loadServerTools(server);
      }
    }

    // Update active server IDs
    this.activeServerIds = currentServerIds;
  }

  /**
   * Load and register tools from a single MCP server
   */
  private async loadServerTools(server: McpServerConfig): Promise<void> {
    try {
      // Build headers object from McpHeader array
      const headers: Record<string, string> = {};
      for (const header of server.headers) {
        headers[header.key] = header.value;
      }

      const client = new McpClient(server.url, headers);
      const result = await client.listTools();

      if (!result.tools || result.tools.length === 0) {
        console.log(`[McpToolManager] Server ${server.id} (${server.url}) has no tools`);
        return;
      }

      const tools = buildMcpTools(server.id, result.tools, client);

      for (const tool of tools) {
        this.registry.register(tool);
      }

      console.log(
        `[McpToolManager] Registered ${tools.length} tools from server ${server.id} (${server.url})`
      );
    } catch (error) {
      console.error(
        `[McpToolManager] Failed to load tools from server ${server.id} (${server.url}):`,
        error
      );
      // Don't throw - just log the error and continue
    }
  }
}
