import { Check } from 'lucide-preact';
import { cn } from '../../lib/utils';

interface CheckboxProps extends Omit<JSX.HTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  className,
  id,
  ...props
}: CheckboxProps) {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
          className={cn(
            'peer w-4 h-4 rounded border appearance-none cursor-pointer',
            'bg-background border-border',
            'checked:bg-accent checked:border-accent',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        <Check
          size={12}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 peer-checked:opacity-100 text-accent-text"
        />
      </div>
      <label
        htmlFor={checkboxId}
        className="text-sm text-text-primary cursor-pointer select-none"
      >
        {label}
      </label>
    </div>
  );
}
