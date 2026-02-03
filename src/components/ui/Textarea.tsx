import { cn } from '../../lib/utils';

interface TextareaProps extends JSX.HTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  rows?: number;
}

export function Textarea({
  label,
  error,
  rows = 3,
  className,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={cn(
          'w-full px-3 py-2 rounded-md border text-sm resize-y min-h-[60px]',
          'bg-background border-border text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500 focus-visible:ring-red-500',
          className
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
