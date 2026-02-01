import type { TabInfo } from '../lib/tabs';

interface ActiveTabToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeTab: TabInfo | null;
}

export function ActiveTabToggle({ checked, onChange, activeTab }: ActiveTabToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        aria-describedby="active-tab-description"
      />
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
          <div className="w-4 h-4 flex-shrink-0 bg-gray-200 rounded" />
        )}
        <span className="truncate max-w-[180px]">
          {activeTab?.title || 'Current tab'}
        </span>
      </span>
      <span id="active-tab-description" className="sr-only">
        Include current tab content in context for next message
      </span>
    </label>
  );
}
