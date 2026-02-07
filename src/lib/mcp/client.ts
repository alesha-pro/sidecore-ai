/**
 * MCP HTTP client with JSON-RPC 2.0 support
 * Supports both standard JSON and Streamable HTTP (SSE) responses
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpListToolsResult,
  McpCallToolResult,
} from './types';

/**
 * MCP client for communicating with MCP servers over HTTP
 */
export class McpClient {
  private requestId = 0;

  constructor(
    private readonly serverUrl: string,
    private readonly headers?: Record<string, string>
  ) {}

  /**
   * List available tools from the MCP server
   */
  async listTools(signal?: AbortSignal): Promise<McpListToolsResult> {
    return this.callRpc<McpListToolsResult>('tools/list', undefined, signal);
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(
    name: string,
    args: unknown,
    signal?: AbortSignal
  ): Promise<McpCallToolResult> {
    return this.callRpc<McpCallToolResult>(
      'tools/call',
      { name, arguments: args },
      signal
    );
  }

  /**
   * Internal JSON-RPC call implementation
   * Handles both standard JSON and Streamable HTTP (SSE) responses
   */
  private async callRpc<T>(
    method: string,
    params?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      ...(params !== undefined && { params }),
    };

    // Check host permission before making request
    try {
      const url = new URL(this.serverUrl);
      const originPattern = `${url.protocol}//${url.host}/*`;
      const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
      if (!hasPermission) {
        throw new Error(
          `No permission to access MCP server at ${url.host}. Grant access to this domain first.`
        );
      }
    } catch (e) {
      // Re-throw permission errors, ignore URL parse or API availability issues
      if (e instanceof Error && e.message.includes('No permission')) throw e;
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...this.headers,
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `MCP request failed: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle Streamable HTTP (SSE) responses
    if (contentType.includes('text/event-stream')) {
      return this.parseSSEResponse<T>(response);
    }

    // Handle standard JSON responses
    const jsonResponse = (await response.json()) as JsonRpcResponse<T>;
    return this.handleJsonRpcResponse(jsonResponse);
  }

  /**
   * Parse Server-Sent Events response
   * Uses the last data payload as the result
   */
  private async parseSSEResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const lines = text.split('\n');

    let lastData: string | null = null;

    for (const line of lines) {
      if (line.startsWith('data:')) {
        lastData = line.slice(5).trim();
      }
    }

    if (!lastData) {
      throw new Error('MCP SSE response contained no data');
    }

    const jsonResponse = JSON.parse(lastData) as JsonRpcResponse<T>;
    return this.handleJsonRpcResponse(jsonResponse);
  }

  /**
   * Handle JSON-RPC response, throwing on errors
   */
  private handleJsonRpcResponse<T>(response: JsonRpcResponse<T>): T {
    if (response.error) {
      const { code, message, data } = response.error;
      throw new Error(
        `MCP error (${code}): ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`
      );
    }

    if (response.result === undefined) {
      throw new Error('MCP response missing result');
    }

    return response.result;
  }
}
