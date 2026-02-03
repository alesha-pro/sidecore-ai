import { useMemo, useState } from 'preact/hooks';
import type { Message } from '../lib/types';
import ThinkingBlock from './ThinkingBlock';
import ToolCallBlock from './ToolCallBlock';
import { Trash2, Pencil } from 'lucide-preact';
import { cn } from '../lib/utils';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';

// Register languages for syntax highlighting
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

// Configure marked with syntax highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Use marked extension API for code highlighting (marked v17+)
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const validLang = lang && hljs.getLanguage(lang);
      const highlighted = validLang
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs${validLang ? ` language-${lang}` : ''}">${highlighted}</code></pre>`;
    },
  },
});

interface ChatMessageProps {
  message: Message;
  isLastUserMessage?: boolean;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  toolOutputs?: Message[];
  isNew?: boolean;
}

export default function ChatMessage({ message, isLastUserMessage, onEdit, onDelete, toolOutputs, isNew }: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);

  // Hide empty assistant messages (no content, no tool_calls, no thinking, not streaming)
  const isEmptyAssistant = message.role === 'assistant'
    && !message.content
    && !message.tool_calls?.length
    && !message.thinking
    && !message.isStreaming;

  if (isEmptyAssistant) {
    return null;
  }
  const renderedContent = useMemo(() => {
    if (message.role === 'assistant' && message.content) {
      return marked.parse(message.content) as string;
    }
    return null;
  }, [message.role, message.content]);

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim()) {
      onEdit(message.id, editContent);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Delete this message?')) {
      onDelete(message.id);
    }
  };

  // Position action buttons based on message role
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex items-end gap-1',
        isUser ? 'justify-end' : 'justify-start',
        // Only animate non-streaming messages
        isNew && !message.isStreaming && 'animate-in fade-in slide-in-from-bottom-2 duration-200',
        'motion-reduce:animate-none'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Action buttons for user messages (left of bubble) */}
      {isUser && isHovered && !isEditing && (
        <div className="flex gap-1 mb-1">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                'p-1.5 rounded-full transition-colors shadow-sm',
                'bg-surface hover:bg-surface-hover text-text-secondary hover:text-red-500',
                'dark:bg-surface-dark dark:hover:bg-surface-hover-dark dark:text-text-secondary-dark'
              )}
              title="Delete message"
              aria-label="Delete message"
            >
              <Trash2 size={14} />
            </button>
          )}
          {isLastUserMessage && onEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={cn(
                'p-1.5 rounded-full transition-colors shadow-sm',
                'bg-surface hover:bg-surface-hover text-text-secondary hover:text-accent',
                'dark:bg-surface-dark dark:hover:bg-surface-hover-dark dark:text-text-secondary-dark'
              )}
              title="Edit message"
              aria-label="Edit message"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      )}

      <div className="max-w-[85%] relative">
        {/* Thinking block above main content (assistant only) */}
        {message.role === 'assistant' && message.thinking && (
          <ThinkingBlock thinking={message.thinking} />
        )}

        {/* Thinking bubble - shown while streaming with no content yet */}
        {message.role === 'assistant' && message.isStreaming && !message.content && !message.tool_calls?.length && (
          <div className={cn(
            'px-4 py-2 rounded-lg',
            'bg-surface border border-border text-text-secondary',
            'dark:bg-surface-dark dark:border-border-dark dark:text-text-secondary-dark',
            'text-sm flex items-center gap-2'
          )}>
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
            Thinking...
          </div>
        )}

        {/* Main content bubble - hide if:
            1. Streaming with no content yet (thinking bubble shown instead)
            2. Assistant with empty content (tool-only message) */}
        {!(message.role === 'assistant' && !message.content) && (
          <div
            className={cn(
              // MSG-01: User message - soft subtle bubble (not bright blue)
              isUser && 'px-4 py-2.5 rounded-2xl bg-accent-subtle text-text-primary dark:bg-accent-subtle dark:text-text-primary',
              // MSG-02: Assistant message - no bubble, generous whitespace
              !isUser && 'py-3'
            )}
          >
            {/* Content */}
            {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
                className={cn(
                  'w-full min-h-[100px] px-2 py-1 text-sm rounded',
                  'border border-border bg-background text-text-primary',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                )}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    'bg-accent text-accent-text hover:bg-accent-hover',
                    'dark:bg-accent-dark dark:text-accent-text-dark dark:hover:bg-accent-hover-dark'
                  )}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    'bg-surface text-text-primary hover:bg-surface-hover',
                    'dark:bg-surface-dark dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.role === 'assistant' ? (
                <div className={cn(
                  'prose prose-sm max-w-none break-words overflow-hidden',
                  'text-text-primary',
                  'dark:prose-invert dark:text-text-primary-dark',
                  // Generous whitespace between elements (MSG-02)
                  '[&>*+*]:mt-4',
                  '[&>pre]:my-4',
                  '[&>ul]:my-3 [&>ol]:my-3'
                )}>
                  <div dangerouslySetInnerHTML={{ __html: renderedContent || '' }} />
                  {message.isStreaming && (
                    <span className={cn(
                      'inline-block w-2 h-4 ml-1 animate-pulse align-middle',
                      'bg-text-secondary dark:bg-text-secondary-dark'
                    )}></span>
                  )}
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
            </>
          )}
          </div>
        )}

        {/* Tool calls section (render below main content) */}
        {message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.tool_calls.map((toolCall) => {
              // Find matching output from toolOutputs
              const output = toolOutputs?.find((out) => out.tool_call_id === toolCall.id);
              return (
                <ToolCallBlock
                  key={toolCall.id || `pending-${toolCall.function.name}`}
                  toolCall={toolCall}
                  output={output}
                  isStreaming={message.isStreaming}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Action buttons for assistant messages (right of bubble) */}
      {!isUser && isHovered && !isEditing && onDelete && (
        <div className="flex gap-1 mb-1">
          <button
            type="button"
            onClick={handleDelete}
            className={cn(
              'p-1.5 rounded-full transition-colors shadow-sm',
              'bg-surface hover:bg-surface-hover text-text-secondary hover:text-red-500',
              'dark:bg-surface-dark dark:hover:bg-surface-hover-dark dark:text-text-secondary-dark'
            )}
            title="Delete message"
            aria-label="Delete message"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
