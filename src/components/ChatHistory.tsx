import type { Message } from '../lib/types';
import ChatMessage from './ChatMessage';

interface ChatHistoryProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  isStreaming?: boolean;
  onStop?: () => void;
}

export default function ChatHistory({ messages, isLoading, error, isStreaming, onStop }: ChatHistoryProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Chat history"
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Start a conversation...
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-sm">
                Thinking...
              </div>
            </div>
          )}
        </>
      )}
      {isStreaming && onStop && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            Stop generating
          </button>
        </div>
      )}
      {error && (
        <div className="flex justify-center">
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
