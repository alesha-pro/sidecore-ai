import type { Message } from '../lib/types';

interface ChatHistoryProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
}

export default function ChatHistory({ messages, isLoading, error }: ChatHistoryProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Chat history"
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 && !isLoading && !error ? (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Start a conversation...
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="max-w-[85%] px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
