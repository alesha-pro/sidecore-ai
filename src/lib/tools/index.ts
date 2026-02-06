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
export {
  ToolRegistry,
  MOCK_BUILT_IN_TOOLS,
  MOCK_MCP_SERVERS,
  getMockTools,
  getMockServers,
} from './registry';

// Global registry instance for the application
import { ToolRegistry } from './registry';
import { registerBuiltInTools } from './builtins';

export const toolRegistry = new ToolRegistry();
// Register built-in tools once at module initialization
registerBuiltInTools(toolRegistry);

export const getTools = () => toolRegistry.getTools();
export const getServers = () => toolRegistry.getServers();
