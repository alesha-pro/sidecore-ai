/**
 * ToolRegistry - stores and manages registered tools
 */

import type { Tool, ToolDefinition } from './types';
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
}
