import { ComponentChildren } from 'preact';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: string;
  children?: ComponentChildren;
  className?: string;
}

export function Card({ title, children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      {title && <h3 className="text-sm font-semibold mb-3 text-text-primary">{title}</h3>}
      {children}
    </div>
  );
}
