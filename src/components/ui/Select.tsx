import { ComponentChildren } from 'preact';
import { ChevronDown } from 'lucide-preact';
import { cn } from '../../lib/utils';

interface SelectProps extends JSX.HTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children?: ComponentChildren;
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'w-full px-3 py-2 pr-8 rounded-md border text-sm appearance-none cursor-pointer',
            'bg-background border-border text-text-primary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary"
        />
      </div>
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
