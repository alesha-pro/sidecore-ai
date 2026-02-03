import type { TabInfo } from '../lib/tabs';
import { cn } from '../lib/utils';

interface ActiveTabToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeTab: TabInfo | null;
}

export function ActiveTabToggle({ checked, onChange, activeTab }: ActiveTabToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby="active-tab-description"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          checked ? 'bg-accent dark:bg-accent-dark' : 'bg-border dark:bg-border-dark'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
      <span className="flex items-center gap-1.5 min-w-0">
        {activeTab?.favIconUrl ? (
          <img
            src={activeTab.favIconUrl}
            alt=""
            className="w-4 h-4 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className={cn(
            'w-4 h-4 flex-shrink-0 rounded',
            'bg-border dark:bg-border-dark'
          )} />
        )}
        <span className={cn(
          'truncate max-w-[180px]',
          'text-text-primary dark:text-text-primary-dark'
        )}>
          {activeTab?.title || 'Current tab'}
        </span>
      </span>
      <span id="active-tab-description" className="sr-only">
        Include current tab content in context for next message
      </span>
    </label>
  );
}
