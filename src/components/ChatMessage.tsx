import { render } from 'preact';
import { useMemo, useState, useEffect, useRef } from 'preact/hooks';
import type { Message, CitationMap } from '../lib/types';
import ThinkingBlock from './ThinkingBlock';
import ToolCallBlock from './ToolCallBlock';
import { CodeBlock } from './CodeBlock';
import { Trash2, Pencil, RefreshCw } from 'lucide-preact';
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

// We use marked just for markdown structure, but we'll intercept code block rendering
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const validLang = lang && hljs.getLanguage(lang);
      const highlighted = validLang
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
      
      // We encode the data so we can extract it during sanitization/rendering
      const encodedCode = encodeURIComponent(text);
      const encodedHtml = encodeURIComponent(`<pre class="p-0 m-0"><code class="hljs${validLang ? ` language-${lang}` : ''}">${highlighted}</code></pre>`);
      
      return `<div data-codeblock="true" data-lang="${lang || ''}" data-code="${encodedCode}" data-html="${encodedHtml}"></div>`;
    },
  },
});

const ALLOWED_TAGS = new Set([
  'A', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4',
  'H5', 'H6', 'HR', 'LI', 'OL', 'P', 'PRE', 'SPAN', 'STRONG', 'TABLE', 'TBODY',
  'TD', 'TH', 'THEAD', 'TR', 'UL',
]);

const DROP_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeElementTree(root: ParentNode): void {
  const elements = Array.from(root.querySelectorAll('*'));

  for (const element of elements) {
    const tagName = element.tagName.toUpperCase();

    if (DROP_CONTENT_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    const allowedAttributes = new Set<string>();
    if (tagName === 'A') {
      allowedAttributes.add('href');
      allowedAttributes.add('title');
    }
    if (tagName === 'CODE') {
      allowedAttributes.add('class');
    }
    if (tagName === 'DIV') {
      allowedAttributes.add('data-codeblock');
      allowedAttributes.add('data-lang');
      allowedAttributes.add('data-code');
      allowedAttributes.add('data-html');
    }

    for (const attr of Array.from(element.attributes)) {
      if (!allowedAttributes.has(attr.name)) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (attr.name === 'href') {
        const safeHref = sanitizeUrl(attr.value);
        if (!safeHref) {
          element.removeAttribute('href');
          continue;
        }
        element.setAttribute('href', safeHref);
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }

      if (attr.name === 'class') {
        const safeClasses = attr.value
          .split(/\s+/)
          .filter((token) => token === 'hljs' || token.startsWith('language-'));
        if (safeClasses.length === 0) {
          element.removeAttribute('class');
        } else {
          element.setAttribute('class', safeClasses.join(' '));
        }
      }
    }
  }
}

function replaceCitations(root: ParentNode, citationMap: CitationMap | undefined): void {
  if (!citationMap || Object.keys(citationMap).length === 0) {
    return;
  }

  const citationKeys = Object.keys(citationMap).sort((a, b) => b.length - a.length);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let currentNode = walker.nextNode();
  while (currentNode) {
    const parent = currentNode.parentElement;
    if (parent && !['A', 'CODE', 'PRE'].includes(parent.tagName.toUpperCase())) {
      textNodes.push(currentNode as Text);
    }
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const content = textNode.textContent || '';
    let cursor = 0;
    let matched = false;
    const fragment = document.createDocumentFragment();

    while (cursor < content.length) {
      let matchedKey: string | null = null;

      for (const key of citationKeys) {
        if (!content.startsWith(key, cursor)) {
          continue;
        }

        const nextChar = content[cursor + key.length] || '';
        if (!nextChar || /\s|[.,;:!?)]/.test(nextChar)) {
          matchedKey = key;
          break;
        }
      }

      if (!matchedKey) {
        fragment.append(content[cursor]);
        cursor += 1;
        continue;
      }

      matched = true;
      const source = citationMap[matchedKey];
      const link = document.createElement('a');
      const safeHref = sanitizeUrl(source.url);
      if (safeHref) {
        link.href = safeHref;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      link.title = source.title;
      link.className = 'citation-link';
      link.textContent = matchedKey;
      fragment.append(link);
      cursor += matchedKey.length;
    }

    if (matched) {
      textNode.replaceWith(fragment);
    }
  }
}

function renderSafeAssistantHtml(content: string, citationMap: CitationMap | undefined): string {
  const parsed = marked.parse(content) as string;
  const parser = new DOMParser();
  const doc = parser.parseFromString(parsed, 'text/html');

  sanitizeElementTree(doc.body);
  replaceCitations(doc.body, citationMap);

  return doc.body.innerHTML;
}

interface ChatMessageProps {
  message: Message;
  isLastUserMessage?: boolean;
  isLatestAssistantMessage?: boolean;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: () => void;
  toolOutputs?: Message[];
  isNew?: boolean;
  onSuggestionClick?: (text: string) => void;
  isStreaming?: boolean;
}

export default function ChatMessage({ message, isLastUserMessage, isLatestAssistantMessage, onEdit, onDelete, onRegenerate, toolOutputs, isNew, onSuggestionClick, isStreaming }: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Hide empty assistant messages (no content, no tool_calls, no thinking, not streaming)
  const isEmptyAssistant = message.role === 'assistant'
    && !message.content
    && !message.tool_calls?.length
    && !message.thinking
    && !message.isStreaming;

  const renderedContent = useMemo(() => {
    if (message.role === 'assistant' && message.content) {
      return renderSafeAssistantHtml(message.content, message.citations);
    }
    return null;
  }, [message.role, message.content, message.citations]);

  // Mount CodeBlock components into placeholders after render
  useEffect(() => {
    if (!contentRef.current) return;

    const placeholders = contentRef.current.querySelectorAll('div[data-codeblock="true"]');
    
    placeholders.forEach((el) => {
      // Prevent double rendering
      if (el.hasAttribute('data-rendered')) return;
      el.setAttribute('data-rendered', 'true');

      const lang = el.getAttribute('data-lang') || '';
      const code = decodeURIComponent(el.getAttribute('data-code') || '');
      const html = decodeURIComponent(el.getAttribute('data-html') || '');
      
      // Render the CodeBlock component into the placeholder
      render(<CodeBlock language={lang} code={code} highlightedHtml={html} />, el);
    });

    // Cleanup: unmount when component unmounts or content changes
    return () => {
      placeholders.forEach((el) => {
        render(null, el);
      });
    };
  }, [renderedContent]);

  if (isEmptyAssistant) {
    return null;
  }

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
        'flex items-end gap-1 min-w-0',
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
        <div className="flex gap-1 mb-1 flex-shrink-0">
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

      <div className="max-w-[85%] relative min-w-0">
        {/* Thinking block above main content (assistant only) */}
        {message.role === 'assistant' && message.thinking && (
          <ThinkingBlock thinking={message.thinking} />
        )}

        {/* Thinking bubble - shown while streaming with no content yet */}
        {message.role === 'assistant' && message.isStreaming && !message.content && !message.tool_calls?.length && (
          <div className={cn(
            'px-4 py-3 text-sm inline-flex items-center gap-2',
            'text-accent dark:text-accent-dark font-medium'
          )}>
            <div className="flex space-x-1 items-center justify-center h-4 opacity-70">
              <div className="w-1.5 h-1.5 bg-accent dark:bg-accent-dark rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-accent dark:bg-accent-dark rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-accent dark:bg-accent-dark rounded-full animate-bounce"></div>
            </div>
            <span className="bg-gradient-to-r from-accent/80 via-accent to-accent/80 dark:from-accent-dark/80 dark:via-accent-dark dark:to-accent-dark/80 bg-clip-text text-transparent animate-pulse">
              Thinking...
            </span>
          </div>
        )}

        {/* Main content bubble - hide if:
            1. Streaming with no content yet (thinking bubble shown instead)
            2. Assistant with empty content (tool-only message) */}
        {!(message.role === 'assistant' && !message.content) && (
          <div
            className={cn(
              // MSG-01: User message - volumetric bubble with gradient and inner shadow
              isUser && 'px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm text-white',
              isUser && 'bg-gradient-to-br from-accent to-accent-hover dark:from-accent dark:to-blue-700',
              isUser && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
              
              // MSG-02: Assistant message - no bubble, borderless with subtle accent line
              !isUser && 'py-1 pl-4 relative',
              !isUser && 'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-accent/20 before:dark:bg-accent-dark/20 before:rounded-full',
              // If streaming, animate the accent line
              !isUser && isStreaming && 'before:bg-accent before:dark:bg-accent-dark before:animate-pulse before:shadow-[0_0_8px_rgba(59,130,246,0.6)]'
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
                <div 
                  ref={contentRef}
                  className={cn(
                  'prose prose-sm max-w-none break-words overflow-hidden min-w-0',
                  'text-text-primary',
                  'dark:prose-invert dark:text-text-primary-dark',
                  // Generous whitespace between elements (MSG-02)
                  '[&>*+*]:mt-4',
                  '[&>pre]:my-4 [&>pre]:overflow-x-auto',
                  '[&>ul]:my-3 [&>ol]:my-3',
                  // Ensure code blocks can scroll
                  '[&_pre]:overflow-x-auto [&_code]:break-words'
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
                <p className="text-sm whitespace-pre-wrap break-words min-w-0">
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

        {/* Follow-up suggestion chips */}
        {message.role === 'assistant' && !message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full transition-colors',
                  'border border-border bg-surface text-text-secondary',
                  'hover:bg-surface-hover hover:text-text-primary hover:border-accent',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  'dark:border-border-dark dark:bg-surface-dark dark:text-text-secondary-dark',
                  'dark:hover:bg-surface-hover-dark dark:hover:text-text-primary-dark dark:hover:border-accent-dark'
                )}
                aria-label={`Follow up: ${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons for assistant messages (right of bubble) */}
      {!isUser && isHovered && !isEditing && (
        <div className="flex gap-1 mb-1 flex-shrink-0">
          {isLatestAssistantMessage && onRegenerate && !isStreaming && (
            <button
              type="button"
              onClick={onRegenerate}
              className={cn(
                'p-1.5 rounded-full transition-colors shadow-sm',
                'bg-surface hover:bg-surface-hover text-text-secondary hover:text-accent',
                'dark:bg-surface-dark dark:hover:bg-surface-hover-dark dark:text-text-secondary-dark'
              )}
              title="Regenerate response"
              aria-label="Regenerate response"
            >
              <RefreshCw size={14} />
            </button>
          )}
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
        </div>
      )}
    </div>
  );
}
