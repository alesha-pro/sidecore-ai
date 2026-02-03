import { ComponentChildren } from 'preact';
import { X } from 'lucide-preact';
import { cn } from '../../lib/utils';

type ChipVariant = 'default' | 'accent';

interface ChipProps {
  children?: ComponentChildren;
  onDismiss?: () => void;
  variant?: ChipVariant;
  className?: string;
}

export function Chip({ children, onDismiss, variant = 'default', className }: ChipProps) {
  const variantStyles: Record<ChipVariant, string> = {
    default: 'bg-surface border border-border text-text-secondary',
    accent: 'bg-accent/10 text-accent border border-accent/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Remove"
          className="ml-0.5 rounded-full p-0.5 hover:bg-surface-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
