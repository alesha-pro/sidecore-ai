import { Wrench } from 'lucide-preact';
import { cn } from '../lib/utils';
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
      className={cn(
        'mt-2 rounded-lg border border-border bg-surface',
        'dark:bg-surface-dark dark:border-border-dark'
      )}
    >
      <summary className={cn(
        'px-3 py-2 cursor-pointer rounded-t-lg flex items-center gap-2',
        'font-medium text-sm hover:bg-surface-hover',
        'dark:hover:bg-surface-hover-dark'
      )}>
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
        <Wrench size={16} className={cn('text-text-secondary', 'dark:text-text-secondary-dark')} aria-hidden="true" />

        {/* Tool name - human readable */}
        <span className={cn('capitalize text-text-primary', 'dark:text-text-primary-dark')}>{displayName}</span>

        {/* Status text */}
        {isAccumulating && <span className="text-yellow-600 text-xs ml-auto">Preparing...</span>}
        {isRunning && <span className="text-blue-600 text-xs ml-auto">Running...</span>}
        {isSuccess && <span className="text-green-600 text-xs ml-auto">Done</span>}
        {isError && <span className="text-red-600 text-xs ml-auto">Error</span>}
      </summary>

      <div className="px-3 py-2 space-y-3 text-xs">
        {/* Input arguments */}
        <div>
          <div className={cn(
            'font-medium mb-1 flex items-center gap-2',
            'text-text-secondary',
            'dark:text-text-secondary-dark'
          )}>
            Input:
            {isArgsIncomplete && (
              <span className="text-yellow-600 text-xs animate-pulse">streaming...</span>
            )}
          </div>
          <pre className={cn(
            'border rounded p-2 overflow-x-auto font-mono',
            isArgsIncomplete
              ? 'bg-yellow-50 border-yellow-200 text-text-primary dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-text-primary-dark'
              : 'bg-background border-border text-text-primary dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
          )}>
            {formattedArgs || '{}'}
          </pre>
        </div>

        {/* Output content */}
        {output && (
          <div>
            <div className={cn(
              'font-medium mb-1',
              'text-text-secondary',
              'dark:text-text-secondary-dark'
            )}>Output:</div>
            <pre className={cn(
              'border rounded p-2 overflow-x-auto font-mono',
              isError
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                : 'bg-background border-border text-text-primary dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
            )}>
              {output.content}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
