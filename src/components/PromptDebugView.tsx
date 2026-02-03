import { useState } from 'preact/hooks';
import type { ChatMessage } from '../lib/llm/types';
import { cn } from '../lib/utils';

interface PromptDebugViewProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export function PromptDebugView({ messages, isOpen, onToggle, isLoading = false }: PromptDebugViewProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // Calculate totals (handle null content for tool_calls messages)
  const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length ?? 0), 0);
  const estimatedTokens = Math.ceil(totalChars / 4);

  const handleCopy = async () => {
    const formatted = messages
      .map(msg => `[${msg.role.toUpperCase()}]\n${msg.content ?? ''}`)
      .join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Role display names and colors
  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'system':
        return { label: 'SYSTEM', color: 'text-purple-600 bg-purple-50' };
      case 'user':
        return { label: 'USER', color: 'text-blue-600 bg-blue-50' };
      case 'assistant':
        return { label: 'ASSISTANT', color: 'text-green-600 bg-green-50' };
      default:
        return { label: role.toUpperCase(), color: 'text-gray-600 bg-gray-50' };
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'border-t',
      'bg-surface border-border',
      'dark:bg-surface-dark dark:border-border-dark'
    )}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full px-4 py-2 flex items-center justify-between text-sm',
          'text-text-primary hover:bg-surface-hover',
          'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
        )}
        aria-expanded={isOpen}
      >
        <span className="font-medium">
          {isOpen ? '\u25BC' : '\u25B6'} View Full Prompt
        </span>
        <span className={cn(
          'text-xs',
          'text-text-secondary',
          'dark:text-text-secondary-dark'
        )}>
          {totalChars.toLocaleString()} chars (~{estimatedTokens.toLocaleString()} tokens)
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {isLoading ? (
            <div className={cn(
              'flex items-center justify-center py-8',
              'text-text-secondary',
              'dark:text-text-secondary-dark'
            )}>
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Extracting content...
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={handleCopy}
                  className={cn(
                    'px-3 py-1 text-xs rounded',
                    'bg-surface border border-border hover:bg-surface-hover',
                    'dark:bg-surface-dark dark:border-border-dark dark:hover:bg-surface-hover-dark'
                  )}
                >
                  {copyStatus === 'copied' ? '\u2713 Copied' : 'Copy to Clipboard'}
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.map((msg, idx) => {
                  const style = getRoleStyle(msg.role);
                  return (
                    <div key={idx} className={cn(
                      'rounded p-3 overflow-hidden',
                      'bg-surface border border-border',
                      'dark:bg-surface-dark dark:border-border-dark'
                    )}>
                      <div className={`inline-block px-2 py-0.5 text-xs font-semibold rounded mb-2 ${style.color}`}>
                        {style.label}
                      </div>
                      <pre className={cn(
                        'text-xs whitespace-pre-wrap break-words font-mono',
                        'text-text-primary',
                        'dark:text-text-primary-dark'
                      )}>
                        {msg.content ?? ''}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
