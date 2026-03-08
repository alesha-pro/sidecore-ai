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
    <div className="relative my-4 rounded-xl overflow-hidden bg-[#1e1e1e] dark:bg-surface-code-dark shadow-md border border-border/20 dark:border-white/10 group">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/20 dark:bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-2">
          {/* Mac-style window controls */}
          <div className="flex gap-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {language || 'text'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200',
            // Always show on mobile, fade in on hover for desktop
            'opacity-100 @sm:opacity-0 @sm:group-hover:opacity-100',
            isCopied
              ? 'text-green-400 bg-green-400/10'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
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