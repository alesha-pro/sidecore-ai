import type { ToolCall, Message } from '../lib/types';

interface ToolCallBlockProps {
  toolCall: ToolCall;
  output?: Message;
  /** True when the parent message is still streaming (tool call may be incomplete) */
  isStreaming?: boolean;
}

export default function ToolCallBlock({ toolCall, output, isStreaming }: ToolCallBlockProps) {
  // Determine status
  const isAccumulating = isStreaming && !output; // Still receiving tool call data
  const isRunning = !isStreaming && !output; // Tool call complete, waiting for execution result
  const isError = output?.isError;
  const isSuccess = output && !output.isError;

  // Parse arguments for display (gracefully handle incomplete JSON during streaming)
  let formattedArgs = toolCall.function.arguments;
  let isArgsIncomplete = false;
  if (formattedArgs) {
    try {
      const parsed = JSON.parse(formattedArgs);
      formattedArgs = JSON.stringify(parsed, null, 2);
    } catch {
      // During streaming, JSON may be incomplete - that's OK
      isArgsIncomplete = isStreaming ?? false;
    }
  }

  // Get a human-readable tool name (remove mcp prefix, replace underscores)
  const displayName = toolCall.function.name
    .replace(/^mcp_[^_]+__/, '') // Remove mcp_{serverId}__ prefix
    .replace(/_/g, ' '); // Replace underscores with spaces

  return (
    <details
      className="mt-2 border border-gray-200 rounded-lg bg-gray-50"
    >
      <summary className="px-3 py-2 cursor-pointer hover:bg-gray-100 rounded-t-lg flex items-center gap-2 font-medium text-sm">
        {/* Status indicator */}
        {isAccumulating && (
          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Preparing"></span>
        )}
        {isRunning && (
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Running"></span>
        )}
        {isSuccess && (
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full" title="Success"></span>
        )}
        {isError && (
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full" title="Error"></span>
        )}

        {/* Tool icon */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
        </svg>

        {/* Tool name - human readable */}
        <span className="text-gray-700 capitalize">{displayName}</span>

        {/* Status text */}
        {isAccumulating && <span className="text-yellow-600 text-xs ml-auto">Preparing...</span>}
        {isRunning && <span className="text-blue-600 text-xs ml-auto">Running...</span>}
        {isSuccess && <span className="text-green-600 text-xs ml-auto">Done</span>}
        {isError && <span className="text-red-600 text-xs ml-auto">Error</span>}
      </summary>

      <div className="px-3 py-2 space-y-3 text-xs">
        {/* Input arguments */}
        <div>
          <div className="text-gray-600 font-medium mb-1 flex items-center gap-2">
            Input:
            {isArgsIncomplete && (
              <span className="text-yellow-600 text-xs animate-pulse">streaming...</span>
            )}
          </div>
          <pre className={`border rounded p-2 overflow-x-auto font-mono ${
            isArgsIncomplete
              ? 'bg-yellow-50 border-yellow-200 text-gray-700'
              : 'bg-white border-gray-200 text-gray-800'
          }`}>
            {formattedArgs || '{}'}
          </pre>
        </div>

        {/* Output content */}
        {output && (
          <div>
            <div className="text-gray-600 font-medium mb-1">Output:</div>
            <pre className={`border rounded p-2 overflow-x-auto font-mono ${
              isError
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-white border-gray-200 text-gray-800'
            }`}>
              {output.content}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
