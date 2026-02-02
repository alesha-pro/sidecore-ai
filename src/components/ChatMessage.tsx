import type { Message } from '../lib/types';
import ThinkingBlock from './ThinkingBlock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

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
          {message.role === 'assistant' ? (
            <div className="prose prose-sm max-w-none text-gray-900">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {displayContent || ''}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse align-middle"></span>
              )}
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {displayContent}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
