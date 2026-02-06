import { useState, useEffect, useRef } from 'preact/hooks';
import type { Message, CitationMap } from '../lib/types';
import ChatMessage from './ChatMessage';
import { cn } from '../lib/utils';

interface ChatHistoryProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  isStreaming?: boolean;
  onStop?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  citationMap?: CitationMap;
  onSuggestionClick?: (text: string) => void;
}

export default function ChatHistory({
  messages,
  isLoading,
  error,
  isStreaming,
  onStop,
  onEditMessage,
  onDeleteMessage,
  citationMap,
  onSuggestionClick,
}: ChatHistoryProps) {
  // Track new messages for animation
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const prevMessagesRef = useRef<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, isLoading]);

  useEffect(() => {
    const prevIds = new Set(prevMessagesRef.current.map(m => m.id));
    const newIds = messages
      .filter(m => !prevIds.has(m.id))
      .map(m => m.id);

    if (newIds.length > 0) {
      setAnimatedIds(prev => new Set([...prev, ...newIds]));

      // Remove from animated set after animation completes
      const timer = setTimeout(() => {
        setAnimatedIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 300); // slightly longer than animation duration

      return () => clearTimeout(timer);
    }

    prevMessagesRef.current = messages;
  }, [messages]);

  // Find the last user message
  const lastUserMessageIndex = messages.map((m, i) => ({ ...m, index: i }))
    .reverse()
    .find((m) => m.role === 'user')?.index;
  // Look-ahead rendering: collect tool outputs for assistant messages
  const renderedMessages: JSX.Element[] = [];
  const skippedIndices = new Set<number>();

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // Skip tool messages already collected
    if (skippedIndices.has(i)) {
      continue;
    }

    // Skip content injection messages (they're in history for LLM, not for UI)
    if (message.contentMessageId) {
      continue;
    }

    // For assistant messages with tool_calls, look ahead for tool outputs
    let toolOutputs: Message[] = [];
    if (message.role === 'assistant' && message.tool_calls) {
      // Collect subsequent tool messages
      for (let j = i + 1; j < messages.length; j++) {
        const nextMessage = messages[j];
        if (nextMessage.role === 'tool') {
          toolOutputs.push(nextMessage);
          skippedIndices.add(j);
        } else {
          // Stop at first non-tool message
          break;
        }
      }
    }

    renderedMessages.push(
      <ChatMessage
        key={message.id}
        message={message}
        isLastUserMessage={i === lastUserMessageIndex}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        toolOutputs={toolOutputs.length > 0 ? toolOutputs : undefined}
        isNew={animatedIds.has(message.id)}
        citationMap={citationMap}
        onSuggestionClick={onSuggestionClick}
      />
    );
  }

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Chat history"
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden p-3 @sm:p-4 space-y-4 min-w-0',
        'bg-background',
        'dark:bg-background-dark'
      )}
    >
      {messages.length === 0 ? (
        <div className={cn(
          'flex items-center justify-center h-full text-sm',
          'text-text-secondary',
          'dark:text-text-secondary-dark'
        )}>
          Start a conversation...
        </div>
      ) : (
        <>
          {renderedMessages}
          {isLoading && (
            <div className="flex justify-start">
              <div className={cn(
                'max-w-[85%] px-4 py-2 rounded-lg text-sm',
                'bg-surface border border-border',
                'text-text-secondary',
                'dark:bg-surface-dark dark:border-border-dark',
                'dark:text-text-secondary-dark'
              )}>
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
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'text-red-600 bg-red-50 border border-red-200',
              'hover:bg-red-100',
              'focus:outline-none focus:ring-2 focus:ring-red-500',
              'dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
              'dark:hover:bg-red-900/30'
            )}
          >
            Stop generating
          </button>
        </div>
      )}
      {error && (
        <div className="flex justify-center">
          <div className={cn(
            'text-sm rounded-lg px-3 py-2',
            'text-red-600 bg-red-50 border border-red-200',
            'dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
          )}>
            {error}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
