/**
 * Built-in tools registration
 * Exports all built-in tools and registration helper
 */

import type { ToolRegistry } from '../registry';
import { fetchTool } from './fetch';
import { searchTool } from './search';

/**
 * Array of all built-in tools
 */
export const builtInTools = [fetchTool, searchTool];

/**
 * Register all built-in tools with the given registry.
 * Safe to call multiple times - uses registry's built-in overwrite warning.
 */
export function registerBuiltInTools(registry: ToolRegistry): void {
  for (const tool of builtInTools) {
    registry.register(tool);
  }
}

// Re-export individual tools for direct access
export { fetchTool } from './fetch';
export { searchTool } from './search';
