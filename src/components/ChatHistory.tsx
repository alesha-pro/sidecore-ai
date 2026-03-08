import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { Message } from '../lib/types';
import ChatMessage from './ChatMessage';
import { RefreshCw, ArrowDown } from 'lucide-preact';
import { cn } from '../lib/utils';

interface ChatHistoryProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  isStreaming?: boolean;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onRegenerate?: () => void;
  onSuggestionClick?: (text: string) => void;
}

export default function ChatHistory({
  messages,
  isLoading,
  error,
  isStreaming,
  onEditMessage,
  onDeleteMessage,
  onRegenerate,
  onSuggestionClick,
}: ChatHistoryProps) {
  // Track new messages for animation
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const prevMessagesRef = useRef<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Smart scroll state
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollThreshold = 100; // px from bottom to be considered "at bottom"

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom < scrollThreshold;
    setIsAtBottom(atBottom);

    // Show button if we are not at the bottom AND (streaming OR not at bottom)
    setShowScrollButton(!atBottom);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      setIsAtBottom(true);
      setShowScrollButton(false);
    }
  }, []);

  // Check if there are new messages to trigger auto-scroll if at bottom
  useEffect(() => {
    if (isAtBottom && (isStreaming || isLoading || messages.length > prevMessagesRef.current.length)) {
      scrollToBottom(messages.length > prevMessagesRef.current.length); // smooth only on new message, not every token
    } else if (!isAtBottom && (isStreaming || messages.length > prevMessagesRef.current.length)) {
      setShowScrollButton(true);
    }
  }, [messages, isStreaming, isLoading, isAtBottom, scrollToBottom]);

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

  // Find the last assistant message (for regenerate button)
  const lastAssistantMessageIndex = messages.map((m, i) => ({ ...m, index: i }))
    .reverse()
    .find((m) => m.role === 'assistant')?.index;
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

    // Add separator for assistant messages (except the very first one)
    const isAssistant = message.role === 'assistant';
    const isFirstRendered = renderedMessages.length === 0;

    if (isAssistant && !isFirstRendered) {
       renderedMessages.push(
         <div key={`sep-${message.id}`} className="w-full border-b border-border/40 dark:border-border-dark/40 my-2"></div>
       );
    }

    renderedMessages.push(
      <ChatMessage
        key={message.id}
        message={message}
        isLastUserMessage={i === lastUserMessageIndex}
        isLatestAssistantMessage={i === lastAssistantMessageIndex}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onRegenerate={onRegenerate}
        toolOutputs={toolOutputs.length > 0 ? toolOutputs : undefined}
        isNew={animatedIds.has(message.id)}
        onSuggestionClick={onSuggestionClick}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden flex flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Chat history"
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden p-3 @sm:p-4 space-y-4 min-w-0 scroll-smooth',
          'bg-transparent custom-scrollbar'
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
                  'px-4 py-3 rounded-2xl rounded-bl-sm text-sm inline-flex items-center gap-1.5',
                  'bg-surface border border-border/50 shadow-sm',
                  'dark:bg-surface-dark dark:border-border-dark/50'
                )}>
                  <div className="flex space-x-1 items-center justify-center h-4">
                    <div className="w-1.5 h-1.5 bg-text-tertiary dark:bg-text-tertiary-dark rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-text-tertiary dark:bg-text-tertiary-dark rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-text-tertiary dark:bg-text-tertiary-dark rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="flex flex-col items-center gap-2 mt-4">
            <div className={cn(
              'text-sm rounded-lg px-3 py-2',
              'text-red-600 bg-red-50 border border-red-200',
              'dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
            )}>
              {error}
            </div>
            {onRegenerate && !isStreaming && lastAssistantMessageIndex !== undefined && (
              <button
                type="button"
                onClick={onRegenerate}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  'text-text-secondary bg-surface border border-border',
                  'hover:bg-surface-hover hover:text-text-primary',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  'dark:text-text-secondary-dark dark:bg-surface-dark dark:border-border-dark',
                  'dark:hover:bg-surface-hover-dark dark:hover:text-text-primary-dark'
                )}
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>
      
      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom(true)}
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full shadow-md transition-all z-10 animate-fade-in',
            'bg-surface border border-border text-text-secondary',
            'hover:bg-surface-hover hover:text-text-primary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            'dark:bg-surface-dark dark:border-border-dark dark:text-text-secondary-dark',
            'dark:hover:bg-surface-hover-dark dark:hover:text-text-primary-dark'
          )}
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={16} />
          {(isStreaming || isLoading) && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-accent rounded-full border-2 border-surface dark:border-surface-dark"></span>
          )}
        </button>
      )}
    </div>
  );
}
