import { useRef, useEffect, useCallback, useState, useMemo } from 'preact/hooks';
import type { TabInfo } from '../lib/tabs';
import type { McpServerConfig, PromptProfile, SlashCommand } from '../lib/types';
import { CommandPicker, type Command } from './CommandPicker';
import { InputToolbar } from './InputToolbar';
import { cn } from '../lib/utils';

interface MentionInputProps {
  onSend: (content: string, tabIds: number[]) => void;
  disabled?: boolean;
  selectedTabs: TabInfo[];
  onRemoveTab: (tabId: number) => void;
  availableTabs: TabInfo[];
  onSelectTab: (tabId: number) => void;
  isPickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onInputChange?: (content: string) => void;
  currentModel: string;
  onModelClick: () => void;
  onSettingsClick?: () => void;
  includeActiveTab?: boolean;
  onActiveTabChange?: (included: boolean) => void;
  disabledTools?: string[];
  disabledServers?: string[];
  mcpServers?: McpServerConfig[];
  onToolToggle?: (toolName: string) => void;
  onServerToggle?: (serverId: string) => void;
  promptProfiles?: PromptProfile[];
  activePromptProfileId?: string | null;
  onProfileChange?: (profileId: string | null) => void;
  customSlashCommands?: SlashCommand[];
}

interface ExtractedContent {
  text: string;
  tabIds: number[];
}

export function MentionInput({
  onSend,
  disabled = false,
  selectedTabs,
  onRemoveTab,
  availableTabs,
  onSelectTab,
  isPickerOpen,
  onPickerOpenChange,
  onInputChange,
  currentModel,
  onModelClick,
  onSettingsClick,
  includeActiveTab = false,
  onActiveTabChange,
  disabledTools,
  disabledServers,
  mcpServers,
  onToolToggle,
  onServerToggle,
  promptProfiles = [],
  activePromptProfileId,
  onProfileChange,
  customSlashCommands = [],
}: MentionInputProps) {
  const inputRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const insertedTabsRef = useRef<Set<number>>(new Set());
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isCommandPickerOpen, setIsCommandPickerOpen] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');

  // Filter out already selected tabs from picker
  const pickerTabs = availableTabs.filter(
    (t) => !selectedTabs.some((s) => s.id === t.id)
  );

  // Reset active index when picker opens
  useEffect(() => {
    if (isPickerOpen) {
      setActiveIndex(pickerTabs.length > 0 ? 0 : -1);
    }
  }, [isPickerOpen, pickerTabs.length]);

  // Close picker on click outside
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        pickerRef.current &&
        !pickerRef.current.contains(target)
      ) {
        onPickerOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen, onPickerOpenChange]);

  // Extract content from the contenteditable
  const extractContent = useCallback((): ExtractedContent => {
    const container = inputRef.current;
    if (!container) {
      return { text: '', tabIds: [] };
    }

    const tabIds: number[] = [];
    let text = '';

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node instanceof HTMLElement) {
        const tabIdAttr = node.getAttribute('data-tab-id');
        if (tabIdAttr) {
          const tabId = parseInt(tabIdAttr, 10);
          tabIds.push(tabId);
          // Include tab title in text for context
          const titleSpan = node.querySelector('[data-chip-title]');
          const title = titleSpan?.textContent || node.textContent || '';
          text += `@[${title.replace('×', '').trim()}]`;
        } else {
          // Process child nodes (e.g., regular spans, divs)
          node.childNodes.forEach(processNode);
        }
      }
    };

    container.childNodes.forEach(processNode);

    return { text: text.trim(), tabIds };
  }, []);

  // Create a chip DOM element (not a Preact component - direct DOM manipulation)
  const createChipElement = useCallback(
    (tabId: number, title: string): HTMLSpanElement => {
      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      chip.setAttribute('data-tab-id', String(tabId));
      chip.className = cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded text-xs',
        'bg-accent-subtle text-accent',
        'dark:bg-accent-subtle-dark dark:text-accent-dark',
        'select-none align-baseline'
      );

      const titleSpan = document.createElement('span');
      titleSpan.className = 'truncate max-w-[120px]';
      titleSpan.title = title;
      titleSpan.setAttribute('data-chip-title', 'true');
      titleSpan.textContent = title;
      chip.appendChild(titleSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = cn(
        'ml-0.5 hover:opacity-70 focus:outline-none',
        'text-accent dark:text-accent-dark'
      );
      removeBtn.textContent = '×';
      removeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        chip.remove();
        insertedTabsRef.current.delete(tabId);
        onRemoveTab(tabId);
      };
      chip.appendChild(removeBtn);

      return chip;
    },
    [onRemoveTab]
  );

  // Insert chip at current cursor position
  const insertChipAtCursor = useCallback(
    (tabId: number, title: string) => {
      const container = inputRef.current;
      if (!container) return;

      container.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // No selection, append to end
        const chip = createChipElement(tabId, title);
        container.appendChild(chip);
        // Move cursor after chip
        const range = document.createRange();
        range.setStartAfter(chip);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }

      const range = selection.getRangeAt(0);

      // Check if we need to remove @ before inserting chip
      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const textContent = startContainer.textContent || '';
        const offset = range.startOffset;
        if (offset > 0 && textContent[offset - 1] === '@') {
          // Remove the @ character
          const newText =
            textContent.slice(0, offset - 1) + textContent.slice(offset);
          startContainer.textContent = newText;
          range.setStart(startContainer, offset - 1);
          range.collapse(true);
        }
      }

      // Insert chip
      const chip = createChipElement(tabId, title);
      range.deleteContents();
      range.insertNode(chip);

      // Move cursor after chip
      range.setStartAfter(chip);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      insertedTabsRef.current.add(tabId);
    },
    [createChipElement]
  );

  // Handle tab selection from picker
  const handlePickerSelect = (tab: TabInfo) => {
    insertChipAtCursor(tab.id, tab.title);
    onSelectTab(tab.id);
    onPickerOpenChange(false);
    inputRef.current?.focus();
  };

  // Sync chips when selectedTabs prop changes
  useEffect(() => {
    const container = inputRef.current;
    if (!container) return;

    const selectedTabIds = new Set(selectedTabs.map((t) => t.id));

    // Add chips for newly selected tabs (only if not already inserted)
    const newTabs = selectedTabs.filter(
      (tab) => !insertedTabsRef.current.has(tab.id)
    );
    for (const tab of newTabs) {
      insertChipAtCursor(tab.id, tab.title);
    }

    // Remove chips for tabs that were removed externally
    const chipsToRemove: HTMLElement[] = [];
    container.querySelectorAll('[data-tab-id]').forEach((chip) => {
      const tabId = parseInt(chip.getAttribute('data-tab-id') || '0', 10);
      if (!selectedTabIds.has(tabId)) {
        chipsToRemove.push(chip as HTMLElement);
        insertedTabsRef.current.delete(tabId);
      }
    });
    for (const chip of chipsToRemove) {
      chip.remove();
    }
  }, [selectedTabs, insertChipAtCursor]);

  // Handle backspace to remove chips
  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle picker navigation when open
    if (isPickerOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, pickerTabs.length - 1));
          return;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          return;
        case 'Enter':
          if (activeIndex >= 0 && pickerTabs[activeIndex]) {
            e.preventDefault();
            handlePickerSelect(pickerTabs[activeIndex]);
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          onPickerOpenChange(false);
          return;
      }
    }

    // Prevent Tab from moving focus when command picker is open
    if (e.key === 'Tab' && isCommandPickerOpen) {
      e.preventDefault();
      return;
    }

    // Submit on Enter (without Shift) when picker is closed
    if (e.key === 'Enter' && !e.shiftKey && !isPickerOpen) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Handle backspace for chip removal
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!range.collapsed) return; // Selection exists, let browser handle

      const container = inputRef.current;
      if (!container) return;

      // Check if cursor is at the start of a text node that follows a chip
      const startContainer = range.startContainer;
      if (
        startContainer.nodeType === Node.TEXT_NODE &&
        range.startOffset === 0
      ) {
        const prevSibling = startContainer.previousSibling;
        if (
          prevSibling instanceof HTMLElement &&
          prevSibling.hasAttribute('data-tab-id')
        ) {
          e.preventDefault();
          const tabId = parseInt(
            prevSibling.getAttribute('data-tab-id') || '0',
            10
          );
          prevSibling.remove();
          insertedTabsRef.current.delete(tabId);
          onRemoveTab(tabId);
          return;
        }
      }

      // Check if cursor is in the container directly and previous sibling is chip
      if (startContainer === container && range.startOffset > 0) {
        const childNodes = Array.from(container.childNodes);
        const prevNode = childNodes[range.startOffset - 1];
        if (
          prevNode instanceof HTMLElement &&
          prevNode.hasAttribute('data-tab-id')
        ) {
          e.preventDefault();
          const tabId = parseInt(
            prevNode.getAttribute('data-tab-id') || '0',
            10
          );
          prevNode.remove();
          insertedTabsRef.current.delete(tabId);
          onRemoveTab(tabId);
          return;
        }
      }
    }
  };

  // Generate profile commands for /profile slash command
  const profileCommands: Command[] = useMemo(() => {
    const commands: Command[] = [];
    // "None" option to deactivate profile
    commands.push({
      name: 'profile-none',
      label: '/profile none',
      description: activePromptProfileId ? 'Deactivate current profile' : 'No profile (current)',
      text: '',
    });
    for (const profile of promptProfiles) {
      const isCurrent = profile.id === activePromptProfileId;
      commands.push({
        name: `profile-${profile.id}`,
        label: `/profile ${profile.name.toLowerCase()}`,
        description: isCurrent ? `${profile.name} (current)` : profile.name,
        text: '',
      });
    }
    return commands;
  }, [promptProfiles, activePromptProfileId]);

  // Generate custom commands from user settings
  const customCommands: Command[] = useMemo(() => {
    return (customSlashCommands ?? []).map(cmd => ({
      name: `custom-${cmd.id}`,
      label: `/${cmd.name}`,
      description: cmd.description || cmd.prompt.slice(0, 60) + (cmd.prompt.length > 60 ? '...' : ''),
      text: cmd.prompt,
    }));
  }, [customSlashCommands]);

  // Handle command selection from picker (Tab - autocomplete only, no send)
  const handleCommandSelect = (command: Command) => {
    const container = inputRef.current;
    if (!container) return;

    // Handle profile switching commands
    if (command.name.startsWith('profile-')) {
      const profileId = command.name === 'profile-none'
        ? null
        : command.name.replace('profile-', '');
      onProfileChange?.(profileId);
      // Clear input (don't send anything)
      container.textContent = '';
      setIsCommandPickerOpen(false);
      setCommandFilter('');
      onInputChange?.('');
      container.focus();
      return;
    }

    // Clear existing content and set command text
    container.textContent = command.text;

    // Move cursor to end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(container);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    setIsCommandPickerOpen(false);
    setCommandFilter('');
    onInputChange?.(command.text);
    container.focus();
  };

  // Handle command selection and send (Enter - select AND send)
  const handleCommandSelectAndSend = (command: Command) => {
    const container = inputRef.current;
    if (!container) return;

    // Profile commands: switch profile, clear input (don't send)
    if (command.name.startsWith('profile-')) {
      handleCommandSelect(command);
      return;
    }

    // Set command text in input
    container.textContent = command.text;
    setIsCommandPickerOpen(false);
    setCommandFilter('');
    onInputChange?.(command.text);

    // Immediately send
    handleSend();
  };

  // Handle input to detect @ and / triggers and notify parent of content changes
  const handleInput = () => {
    const container = inputRef.current;
    if (!container) return;

    // Notify parent of content change (for debug preview)
    const { text } = extractContent();
    onInputChange?.(text);

    // Get current text content at cursor position
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;

    // Check if cursor is in a text node
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textContent = startContainer.textContent || '';
      const offset = range.startOffset;

      // Check for @ trigger
      if (offset > 0 && textContent[offset - 1] === '@') {
        onPickerOpenChange(true);
        setIsCommandPickerOpen(false);
      }

      // Check for / at the start of input (for commands)
      if (textContent.startsWith('/')) {
        const filter = textContent.slice(1); // Remove leading /
        setCommandFilter(filter);
        setIsCommandPickerOpen(true);
        onPickerOpenChange(false);
      } else {
        setIsCommandPickerOpen(false);
        setCommandFilter('');
      }
    }
  };

  // Handle send
  const handleSend = () => {
    const { text, tabIds } = extractContent();
    if (!text && tabIds.length === 0) return;

    onSend(text, tabIds);

    // Clear input
    if (inputRef.current) {
      inputRef.current.innerHTML = '';
      insertedTabsRef.current.clear();
    }

    // Notify parent that input is now empty
    onInputChange?.('');
  };

  // Trigger @ picker from toolbar button
  const handleAtClick = () => {
    onPickerOpenChange(true);
    inputRef.current?.focus();
  };

  // Trigger / picker from toolbar button
  const handleSlashClick = () => {
    const container = inputRef.current;
    if (!container) return;

    // Set "/" in input and open command picker
    container.textContent = '/';
    setCommandFilter('');
    setIsCommandPickerOpen(true);

    // Move cursor to end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(container);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    container.focus();
    onInputChange?.('/');
  };

  return (
    <div className={cn(
      'bg-surface border-t border-border min-w-0',
      'dark:bg-surface-dark dark:border-border-dark'
    )}>
      <div className="p-2 @sm:p-3 pb-2 min-w-0">
        <div className="relative min-w-0">
          {/* Inline Tab Picker - appears above input */}
          {isPickerOpen && pickerTabs.length > 0 && (
            <div
              ref={pickerRef}
              className={cn(
                'absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-auto z-10 min-w-0',
                'rounded-lg border border-border bg-surface shadow-lg',
                'dark:bg-surface-dark dark:border-border-dark'
              )}
            >
              <ul role="listbox" aria-label="Select a tab">
                {pickerTabs.map((tab, index) => (
                  <li
                    key={tab.id}
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => handlePickerSelect(tab)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 cursor-pointer',
                      'hover:bg-surface-hover',
                      'dark:hover:bg-surface-hover-dark',
                      index === activeIndex && 'bg-accent-subtle dark:bg-accent-subtle-dark'
                    )}
                  >
                    {tab.favIconUrl ? (
                      <img
                        src={tab.favIconUrl}
                        alt=""
                        className="w-4 h-4 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className={cn(
                        'w-4 h-4 flex-shrink-0',
                        'text-text-tertiary dark:text-text-tertiary-dark'
                      )}>
                        📄
                      </span>
                    )}
                    <span className={cn(
                      'truncate text-sm',
                      'text-text-primary dark:text-text-primary-dark'
                    )}>{tab.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Command Picker - appears above input */}
          <CommandPicker
            isOpen={isCommandPickerOpen}
            onClose={() => {
              setIsCommandPickerOpen(false);
              setCommandFilter('');
            }}
            onSelect={handleCommandSelectAndSend}
            onComplete={handleCommandSelect}
            filter={commandFilter}
            extraCommands={[...profileCommands, ...customCommands]}
          />

          {/* Input area with inline Send button */}
          <div className="relative min-w-0">
            <div
              ref={inputRef}
              contentEditable={!disabled}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              className={cn(
                'w-full min-h-[40px] max-h-[200px] overflow-y-auto min-w-0',
                'px-3 py-2 pr-10 rounded-lg',
                'border border-border bg-background',
                'text-sm text-text-primary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'empty:before:content-[attr(data-placeholder)] empty:before:text-text-tertiary',
                'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark',
                'dark:empty:before:text-text-tertiary-dark',
                'break-words'
              )}
              data-placeholder="Type a message, @ for tabs, / for commands"
              role="textbox"
              aria-label="Message input"
              aria-multiline="true"
            />

            {/* Send button - positioned inside input, on the right */}
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled}
              className={cn(
                'absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors',
                'text-accent hover:bg-accent-subtle',
                'dark:text-accent-dark dark:hover:bg-accent-subtle-dark',
                'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
              )}
              title="Send message (Enter)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar below input */}
      <InputToolbar
        currentModel={currentModel}
        onModelClick={onModelClick}
        onAtClick={handleAtClick}
        onSlashClick={handleSlashClick}
        disabled={disabled}
        includeActiveTab={includeActiveTab}
        onActiveTabChange={onActiveTabChange}
        disabledTools={disabledTools}
        disabledServers={disabledServers}
        mcpServers={mcpServers}
        onToolToggle={onToolToggle}
        onServerToggle={onServerToggle}
      />
    </div>
  );
}
