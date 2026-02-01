import { ActiveTabToggle } from './ActiveTabToggle';
import { TabPicker } from './TabPicker/TabPicker';
import type { TabInfo } from '../lib/tabs';
import type { TabSelection } from '../lib/types';

interface ContextBarProps {
  activeTab: TabInfo | null;
  tabs: TabInfo[];
  selection: TabSelection;
  onSelectionChange: (selection: TabSelection) => void;
  isPickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}

export function ContextBar({
  activeTab,
  tabs,
  selection,
  onSelectionChange,
  isPickerOpen,
  onPickerOpenChange,
}: ContextBarProps) {
  const handleActiveTabToggle = (checked: boolean) => {
    onSelectionChange({
      ...selection,
      includeActiveTab: checked,
    });
  };

  const handleTabSelect = (tabId: number) => {
    const newSelected = new Set(selection.selectedTabIds);
    newSelected.add(tabId);
    onSelectionChange({
      ...selection,
      selectedTabIds: newSelected,
    });
  };

  const handleTabDeselect = (tabId: number) => {
    const newSelected = new Set(selection.selectedTabIds);
    newSelected.delete(tabId);
    onSelectionChange({
      ...selection,
      selectedTabIds: newSelected,
    });
  };

  // Filter tabs for picker (exclude active tab since it's in the toggle)
  const pickerTabs = tabs.filter((t) => t.id !== activeTab?.id);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
      <ActiveTabToggle
        checked={selection.includeActiveTab}
        onChange={handleActiveTabToggle}
        activeTab={activeTab}
      />

      <div className="h-4 w-px bg-gray-300" aria-hidden="true" />

      <TabPicker
        tabs={pickerTabs}
        selectedIds={selection.selectedTabIds}
        onSelect={handleTabSelect}
        onDeselect={handleTabDeselect}
        isOpen={isPickerOpen}
        onOpenChange={onPickerOpenChange}
      />
    </div>
  );
}
