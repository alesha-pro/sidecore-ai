import { ChevronRight } from 'lucide-preact';
import { cn } from '../lib/utils';

interface ThinkingBlockProps {
  thinking: string;
}

export default function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  return (
    <details className={cn(
      'mb-2 rounded-lg border border-border bg-surface min-w-0',
      'dark:bg-surface-dark dark:border-border-dark'
    )}>
      <summary className={cn(
        'px-3 py-2 cursor-pointer rounded-t-lg select-none flex items-center gap-1 min-w-0',
        'text-sm font-medium text-text-secondary hover:bg-surface-hover',
        'dark:text-text-secondary-dark dark:hover:bg-surface-hover-dark'
      )}>
        <ChevronRight
          size={16}
          className="transition-transform duration-200 [details[open]>&]:rotate-90 flex-shrink-0"
          aria-hidden="true"
        />
        <span className="truncate">Show thinking</span>
      </summary>
      <div className={cn(
        'px-3 py-2 text-sm border-t whitespace-pre-wrap break-words overflow-x-auto',
        'text-text-secondary border-border',
        'dark:text-text-secondary-dark dark:border-border-dark'
      )}>
        {thinking}
      </div>
    </details>
  );
}
