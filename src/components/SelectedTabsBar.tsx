import { useState } from 'preact/hooks';
import { ChevronRight, X } from 'lucide-preact';
import type { TabInfo } from '../lib/tabs';
import { cn } from '../lib/utils';

interface SelectedTabsBarProps {
  tabs: TabInfo[];
  includeActiveTab: boolean;
  activeTab: TabInfo | null;
  onRemoveTab: (tabId: number) => void;
  onToggleActiveTab: (include: boolean) => void;
}

export function SelectedTabsBar({
  tabs,
  includeActiveTab,
  activeTab,
  onRemoveTab,
  onToggleActiveTab,
}: SelectedTabsBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build display list: active tab first (if included), then selected tabs
  const displayTabs: Array<TabInfo & { isActive?: boolean }> = [];

  if (includeActiveTab && activeTab) {
    displayTabs.push({ ...activeTab, isActive: true });
  }

  // Add selected tabs (excluding active to avoid duplicates)
  for (const tab of tabs) {
    if (tab.id !== activeTab?.id) {
      displayTabs.push(tab);
    }
  }

  // Don't render if nothing to show
  if (displayTabs.length === 0) {
    return null;
  }

  // Build collapsed summary text
  const getSummaryText = () => {
    if (displayTabs.length === 1) {
      return displayTabs[0].title;
    }
    if (displayTabs.length === 2) {
      return `${truncateTitle(displayTabs[0].title)}, ${truncateTitle(displayTabs[1].title)}`;
    }
    return `${truncateTitle(displayTabs[0].title)}, +${displayTabs.length - 1} more`;
  };

  const truncateTitle = (title: string, maxLen = 30) => {
    if (title.length <= maxLen) return title;
    return title.slice(0, maxLen) + '...';
  };

  return (
    <div className={cn(
      'px-3 py-1 border-t',
      'bg-surface border-border',
      'dark:bg-surface-dark dark:border-border-dark'
    )}>
      {/* Collapsed view - thin strip */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left text-xs',
          'text-text-secondary hover:text-text-primary',
          'dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
        )}
        aria-expanded={isExpanded}
      >
        <ChevronRight
          size={12}
          className={cn(
            'transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <span className={cn(
          'text-text-tertiary',
          'dark:text-text-tertiary-dark'
        )}>
          {displayTabs.length} {displayTabs.length === 1 ? 'tab' : 'tabs'} selected
        </span>
        {!isExpanded && (
          <span className={cn(
            'truncate flex-1',
            'text-text-tertiary',
            'dark:text-text-tertiary-dark'
          )}>
            — {getSummaryText()}
          </span>
        )}
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="mt-1.5 space-y-0.5 pl-4">
          {displayTabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-1.5 py-0.5 group"
            >
              {/* Favicon or generic icon */}
              {tab.favIconUrl ? (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="w-3 h-3 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <svg
                  className={cn(
                    'w-3 h-3 flex-shrink-0',
                    'text-text-tertiary dark:text-text-tertiary-dark'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              )}

              {/* Title */}
              <span
                className={cn(
                  'flex-1 text-xs truncate',
                  'text-text-primary dark:text-text-primary-dark'
                )}
                title={tab.title}
              >
                {tab.title}
                {'isActive' in tab && tab.isActive && (
                  <span className={cn(
                    'ml-1',
                    'text-accent dark:text-accent-dark'
                  )}>(active)</span>
                )}
              </span>

              {/* Remove button or toggle for active tab */}
              {'isActive' in tab && tab.isActive ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleActiveTab(false);
                  }}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'text-text-tertiary hover:text-text-primary',
                    'dark:text-text-tertiary-dark dark:hover:text-text-primary-dark'
                  )}
                  aria-label="Exclude active tab"
                  title="Exclude active tab"
                >
                  <X size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTab(tab.id);
                  }}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'text-text-tertiary hover:text-destructive',
                    'dark:text-text-tertiary-dark dark:hover:text-destructive-dark'
                  )}
                  aria-label={`Remove ${tab.title}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
