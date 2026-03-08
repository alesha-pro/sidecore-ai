import { useState } from 'preact/hooks';
import { Copy, Check } from 'lucide-preact';
import { cn } from '../lib/utils';

interface CodeBlockProps {
  language: string;
  code: string;
  highlightedHtml?: string;
}

export function CodeBlock({ language, code, highlightedHtml }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  return (
    <div className="relative my-4 rounded-md overflow-hidden bg-surface dark:bg-surface-code-dark border border-border dark:border-border-dark group">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-hover dark:bg-surface-hover-dark border-b border-border dark:border-border-dark">
        <span className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark uppercase">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-opacity duration-200',
            // Always show on mobile, fade in on hover for desktop
            'opacity-100 @sm:opacity-0 @sm:group-hover:opacity-100',
            isCopied
              ? 'text-green-600 dark:text-green-400'
              : 'text-text-secondary hover:text-text-primary dark:text-text-secondary-dark dark:hover:text-text-primary-dark hover:bg-surface dark:hover:bg-surface-dark'
          )}
          aria-label={isCopied ? 'Copied' : 'Copy code'}
        >
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="relative overflow-x-auto custom-scrollbar code-block-shadow">
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} className="p-4 min-w-max" />
        ) : (
          <pre className="p-4 m-0 min-w-max">
            <code className={cn("hljs block", language && `language-${language}`)}>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}