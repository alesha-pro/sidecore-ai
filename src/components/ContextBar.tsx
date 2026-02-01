import { ActiveTabToggle } from './ActiveTabToggle';
import type { TabInfo } from '../lib/tabs';
import type { TabSelection } from '../lib/types';

interface ContextBarProps {
  activeTab: TabInfo | null;
  selection: TabSelection;
  onSelectionChange: (selection: TabSelection) => void;
  onOpenPicker: () => void;
}

export function ContextBar({
  activeTab,
  selection,
  onSelectionChange,
  onOpenPicker,
}: ContextBarProps) {
  const handleActiveTabToggle = (checked: boolean) => {
    onSelectionChange({
      ...selection,
      includeActiveTab: checked,
    });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
      <ActiveTabToggle
        checked={selection.includeActiveTab}
        onChange={handleActiveTabToggle}
        activeTab={activeTab}
      />

      <div className="h-4 w-px bg-gray-300" aria-hidden="true" />

      <button
        type="button"
        onClick={onOpenPicker}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        @ Add tabs
      </button>
    </div>
  );
}
