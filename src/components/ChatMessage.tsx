import { useMemo, useState } from 'preact/hooks';
import type { Message } from '../lib/types';
import ThinkingBlock from './ThinkingBlock';
import ToolCallBlock from './ToolCallBlock';
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
}

export default function ChatMessage({ message, isLastUserMessage, onEdit, onDelete, toolOutputs }: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
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
      className={`flex items-end gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}
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
              className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-red-600 transition-colors shadow-sm"
              title="Delete message"
              aria-label="Delete message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
          {isLastUserMessage && onEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors shadow-sm"
              title="Edit message"
              aria-label="Edit message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
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
          <div className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-sm flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
            Thinking...
          </div>
        )}

        {/* Main content bubble - hide if streaming with no content (thinking shown instead) */}
        {!(message.role === 'assistant' && message.isStreaming && !message.content && !message.tool_calls?.length) && (
          <div
            className={`px-4 py-2 rounded-lg ${
              isUser
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}
          >
            {/* Content */}
            {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
                className="w-full min-h-[100px] px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none text-gray-900 break-words overflow-hidden">
                  <div dangerouslySetInnerHTML={{ __html: renderedContent || '' }} />
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse align-middle"></span>
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
            className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-red-600 transition-colors shadow-sm"
            title="Delete message"
            aria-label="Delete message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
