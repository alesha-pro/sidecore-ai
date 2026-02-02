import type { ToolCall, Message } from '../lib/types';

interface ToolCallBlockProps {
  toolCall: ToolCall;
  output?: Message;
}

export default function ToolCallBlock({ toolCall, output }: ToolCallBlockProps) {
  // Determine status
  const isRunning = !output;
  const isError = output?.isError;
  const isSuccess = output && !output.isError;

  // Parse arguments for display
  let formattedArgs = toolCall.function.arguments;
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    formattedArgs = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  return (
    <details
      className="mt-2 border border-gray-200 rounded-lg bg-gray-50"
      open={isRunning || !!output}
    >
      <summary className="px-3 py-2 cursor-pointer hover:bg-gray-100 rounded-t-lg flex items-center gap-2 font-medium text-sm">
        {/* Status indicator */}
        {isRunning && (
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Running"></span>
        )}
        {isSuccess && (
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full" title="Success"></span>
        )}
        {isError && (
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full" title="Error"></span>
        )}

        {/* Tool name */}
        <span className="text-gray-700">{toolCall.function.name}</span>

        {/* Status text */}
        {isRunning && <span className="text-gray-500 text-xs ml-auto">Running...</span>}
      </summary>

      <div className="px-3 py-2 space-y-3 text-xs">
        {/* Input arguments */}
        <div>
          <div className="text-gray-600 font-medium mb-1">Input:</div>
          <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-gray-800 font-mono">
            {formattedArgs}
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
