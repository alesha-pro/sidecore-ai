import type { Message } from '../lib/types';
import ThinkingBlock from './ThinkingBlock';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
}

export default function ChatMessage({ message, isStreaming, streamingContent }: ChatMessageProps) {
  const displayContent = isStreaming ? streamingContent : message.content;

  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className="max-w-[85%]">
        {/* Thinking block above main content (assistant only) */}
        {message.role === 'assistant' && message.thinking && (
          <ThinkingBlock thinking={message.thinking} />
        )}

        {/* Main content bubble */}
        <div
          className={`px-4 py-2 rounded-lg ${
            message.role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {displayContent}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse align-middle"></span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
