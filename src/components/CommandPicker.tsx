import { useRef, useEffect, useState } from 'preact/hooks';

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
      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10"
    >
      <ul role="listbox" aria-label="Select a command">
        {filteredCommands.map((cmd, index) => (
          <li
            key={cmd.name}
            role="option"
            aria-selected={index === activeIndex}
            onClick={() => onSelect(cmd)}
            className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
              index === activeIndex
                ? 'bg-blue-50 text-blue-900'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{cmd.label}</span>
              <span className="text-xs text-gray-500">{cmd.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
