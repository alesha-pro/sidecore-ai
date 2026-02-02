/**
 * Tools module - exports types and registry for the Agentic Tool system
 */

export type {
  Tool,
  ToolDefinition,
  JSONSchema,
  ToolSource,
  ToolInputSchema,
  MCPServer,
  MCPServerStatus,
  ToolRegistryService,
} from './types';
export { toToolDefinition } from './types';
export { ToolRegistry } from './registry';

// Global registry instance for the application
import { ToolRegistry } from './registry';
export const toolRegistry = new ToolRegistry();
