import { X } from 'lucide-preact';
import { cn } from '../lib/utils';

interface TabChipProps {
  tabId: number;
  title: string;
  onRemove: (tabId: number) => void;
}

export function TabChip({ tabId, title, onRemove }: TabChipProps) {
  const handleRemove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(tabId);
  };

  return (
    <span
      contentEditable={false}
      data-tab-id={tabId}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 mx-1 text-xs font-medium select-none align-baseline',
        'bg-accent-subtle text-accent border border-accent/20',
        'dark:bg-accent-subtle-dark dark:text-accent-dark dark:border-accent-dark/20'
      )}
    >
      <span className="truncate max-w-[120px]" title={title}>
        {title}
      </span>
      <button
        type="button"
        onClick={handleRemove}
        className={cn(
          'ml-0.5 rounded-full p-0.5',
          'hover:bg-accent/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          'dark:hover:bg-accent-dark/20 dark:focus-visible:ring-accent-dark'
        )}
        aria-label={`Remove ${title}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}
