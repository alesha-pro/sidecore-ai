import { useState, useRef, useEffect } from 'preact/hooks';
import type { TabInfo } from '../../lib/tabs';
import { TabItem } from './TabItem';

interface TabPickerProps {
  tabs: TabInfo[];
  selectedIds: Set<number>;
  onSelect: (tabId: number) => void;
  onDeselect: (tabId: number) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TabPicker({
  tabs,
  selectedIds,
  onSelect,
  onDeselect,
  isOpen,
  onOpenChange,
}: TabPickerProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = 'tab-picker-listbox';

  // Reset active index when opened
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          onOpenChange(true);
        } else {
          setActiveIndex((prev) => Math.min(prev + 1, tabs.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && activeIndex >= 0 && tabs[activeIndex]) {
          const tab = tabs[activeIndex];
          if (selectedIds.has(tab.id)) {
            onDeselect(tab.id);
          } else {
            onSelect(tab.id);
          }
        } else {
          onOpenChange(!isOpen);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  };

  const handleTabClick = (tabId: number) => {
    if (selectedIds.has(tabId)) {
      onDeselect(tabId);
    } else {
      onSelect(tabId);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 && tabs[activeIndex]
            ? `tab-option-${tabs[activeIndex].id}`
            : undefined
        }
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={handleKeyDown}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        @ Add tabs {selectedIds.size > 0 && `(${selectedIds.size})`}
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Open tabs"
          className="absolute z-10 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {tabs.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No other tabs</li>
          ) : (
            tabs.map((tab, index) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isSelected={selectedIds.has(tab.id)}
                isActive={index === activeIndex}
                onClick={() => handleTabClick(tab.id)}
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
}
