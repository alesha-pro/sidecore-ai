import type { ChatSummary } from '../lib/types';
import { Trash2 } from 'lucide-preact';
import { cn } from '../lib/utils';

interface ChatListProps {
  chats: ChatSummary[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  onDeleteChat,
}: ChatListProps) {
  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Delete chat "${title}"?`)) {
      onDeleteChat(id);
    }
  };

  return (
    <div className={cn(
      'flex flex-col h-full',
      'bg-background',
      'dark:bg-background-dark'
    )}>
      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className={cn(
            'p-4 text-center text-xs',
            'text-text-secondary',
            'dark:text-text-secondary-dark'
          )}>
            No chats yet
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  'group relative px-2 py-2 rounded cursor-pointer transition-colors border',
                  currentChatId === chat.id ? cn(
                    'bg-accent-subtle border-accent-subtle',
                    'dark:bg-accent-subtle-dark dark:border-accent-subtle-dark'
                  ) : cn(
                    'hover:bg-surface-hover border-transparent',
                    'dark:hover:bg-surface-hover-dark'
                  )
                )}
                onClick={() => onSelectChat(chat.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-xs font-medium truncate',
                      'text-text-primary',
                      'dark:text-text-primary-dark'
                    )}>
                      {chat.title}
                    </div>
                    <div className={cn(
                      'flex items-center gap-2 mt-1 text-[10px]',
                      'text-text-secondary',
                      'dark:text-text-secondary-dark'
                    )}>
                      <span>{chat.messageCount} msg</span>
                      <span>•</span>
                      <span>{formatRelativeTime(chat.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(chat.id, chat.title);
                    }}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 p-1 rounded transition-all',
                      'text-text-secondary hover:text-red-600 hover:bg-red-50',
                      'dark:text-text-secondary-dark dark:hover:text-red-400 dark:hover:bg-red-900/30'
                    )}
                    title="Delete chat"
                    aria-label={`Delete chat: ${chat.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
