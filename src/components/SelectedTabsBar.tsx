import { useState } from 'preact/hooks';
import type { TabInfo } from '../lib/tabs';

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
    <div className="px-3 py-1 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {/* Collapsed view - thin strip */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 w-full text-left text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        aria-expanded={isExpanded}
      >
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-500 dark:text-gray-400">
          {displayTabs.length} {displayTabs.length === 1 ? 'tab' : 'tabs'} selected
        </span>
        {!isExpanded && (
          <span className="text-gray-400 dark:text-gray-500 truncate flex-1">
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
                  className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0"
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
                className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate"
                title={tab.title}
              >
                {tab.title}
                {'isActive' in tab && tab.isActive && (
                  <span className="ml-1 text-blue-500 dark:text-blue-400">(active)</span>
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
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Exclude active tab"
                  title="Exclude active tab"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTab(tab.id);
                  }}
                  className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${tab.title}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
