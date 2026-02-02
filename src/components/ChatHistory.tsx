import type { Message } from '../lib/types';
import ChatMessage from './ChatMessage';

interface ChatHistoryProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  isStreaming?: boolean;
  onStop?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
}

export default function ChatHistory({
  messages,
  isLoading,
  error,
  isStreaming,
  onStop,
  onEditMessage,
  onDeleteMessage,
}: ChatHistoryProps) {
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
      />
    );
  }

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Chat history"
      className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Start a conversation...
        </div>
      ) : (
        <>
          {renderedMessages}
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
