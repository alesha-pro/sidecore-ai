import { ActiveTabToggle } from './ActiveTabToggle';
import type { TabInfo } from '../lib/tabs';
import type { TabSelection } from '../lib/types';

interface ContextBarProps {
  activeTab: TabInfo | null;
  selection: TabSelection;
  onSelectionChange: (selection: TabSelection) => void;
}

export function ContextBar({
  activeTab,
  selection,
  onSelectionChange,
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
    </div>
  );
}
