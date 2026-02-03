import { cn } from '../../lib/utils';

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <hr className={cn('border-border', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-border" />
      <span className="text-xs text-text-tertiary">{label}</span>
      <hr className="flex-1 border-border" />
    </div>
  );
}
