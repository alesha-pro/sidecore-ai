import { ComponentChildren } from 'preact';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ComponentChildren;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-accent-text hover:bg-accent-hover',
    secondary: 'bg-surface border border-border text-text-primary hover:bg-surface-hover',
    ghost: 'text-text-primary hover:bg-surface-hover',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-2 py-1 text-sm gap-1',
    md: 'px-3 py-1.5 text-base gap-1.5',
    lg: 'px-4 py-2 text-lg gap-2',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
