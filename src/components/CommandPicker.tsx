import { useRef, useEffect, useState } from 'preact/hooks';
import { cn } from '../lib/utils';

export interface Command {
  name: string;
  label: string;
  description: string;
  text: string;
}

export const COMMANDS: Command[] = [
  {
    name: 'summarize',
    label: '/summarize',
    description: 'Summarize the page content',
    text: 'Summarize this page in a few paragraphs',
  },
  {
    name: 'translate',
    label: '/translate',
    description: 'Translate the main content',
    text: 'Translate the main content of this page',
  },
  {
    name: 'explain',
    label: '/explain',
    description: 'Explain key concepts simply',
    text: 'Explain the key concepts from this page in simple terms',
  },
  {
    name: 'keypoints',
    label: '/keypoints',
    description: 'Extract key points and ideas',
    text: 'Extract the key points and main ideas from this page',
  },
];

interface CommandPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: Command) => void;
  filter?: string;
}

export function CommandPicker({
  isOpen,
  onClose,
  onSelect,
  filter = '',
}: CommandPickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Filter commands by name
  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Reset active index when filter changes or picker opens
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(filteredCommands.length > 0 ? 0 : -1);
    }
  }, [isOpen, filter, filteredCommands.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (activeIndex >= 0 && filteredCommands[activeIndex]) {
            e.preventDefault();
            onSelect(filteredCommands[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filteredCommands, onSelect, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={pickerRef}
      className={cn(
        'absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-auto z-10',
        'rounded-lg border border-border bg-surface shadow-lg',
        'dark:bg-surface-dark dark:border-border-dark'
      )}
    >
      <ul role="listbox" aria-label="Select a command">
        {filteredCommands.map((cmd, index) => {
          const isHighlighted = index === activeIndex;
          return (
            <li
              key={cmd.name}
              role="option"
              aria-selected={isHighlighted}
              onClick={() => onSelect(cmd)}
              className={cn(
                'px-3 py-2 cursor-pointer',
                'hover:bg-surface-hover',
                'dark:hover:bg-surface-hover-dark',
                isHighlighted && 'bg-accent-subtle dark:bg-accent-subtle-dark'
              )}
            >
              <div className="flex flex-col">
                <span className={cn(
                  'text-sm font-medium',
                  'text-text-primary dark:text-text-primary-dark'
                )}>{cmd.label}</span>
                <span className={cn(
                  'text-xs',
                  'text-text-secondary dark:text-text-secondary-dark'
                )}>{cmd.description}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
