import { useState } from 'preact/hooks';
import type { ChatMessage } from '../lib/llm/types';

interface PromptDebugViewProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export function PromptDebugView({ messages, isOpen, onToggle, isLoading = false }: PromptDebugViewProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // Calculate totals
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);

  const handleCopy = async () => {
    const formatted = messages
      .map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`)
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
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-700 hover:bg-gray-100"
        aria-expanded={isOpen}
      >
        <span className="font-medium">
          {isOpen ? '\u25BC' : '\u25B6'} View Full Prompt
        </span>
        <span className="text-xs text-gray-500">
          {totalChars.toLocaleString()} chars (~{estimatedTokens.toLocaleString()} tokens)
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
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
                  className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  {copyStatus === 'copied' ? '\u2713 Copied' : 'Copy to Clipboard'}
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.map((msg, idx) => {
                  const style = getRoleStyle(msg.role);
                  return (
                    <div key={idx} className="bg-white border border-gray-200 rounded p-3">
                      <div className={`inline-block px-2 py-0.5 text-xs font-semibold rounded mb-2 ${style.color}`}>
                        {style.label}
                      </div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto">
                        {msg.content}
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
