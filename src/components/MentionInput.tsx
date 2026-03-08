import { useRef, useEffect, useState, useMemo } from 'preact/hooks';
import type { TabInfo } from '../lib/tabs';
import type { McpServerConfig, SlashCommand } from '../lib/types';
import { CommandPicker, type Command } from './CommandPicker';
import { InputToolbar } from './InputToolbar';
import { StopCircle } from 'lucide-preact';
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
  customSlashCommands?: SlashCommand[];
  isStreaming?: boolean;
  onStop?: () => void;
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
  customSlashCommands = [],
  isStreaming = false,
  onStop,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isCommandPickerOpen, setIsCommandPickerOpen] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [inputValue, setInputValue] = useState('');

  const [tabFilter, setTabFilter] = useState('');

  // Filter out already selected tabs from picker, and apply search filter
  const pickerTabs = useMemo(() => {
    let filtered = availableTabs.filter((t) => !selectedTabs.some((s) => s.id === t.id));
    if (tabFilter) {
      const lowerFilter = tabFilter.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(lowerFilter) || t.url?.toLowerCase().includes(lowerFilter));
    }
    return filtered;
  }, [availableTabs, selectedTabs, tabFilter]);

  // Auto-resize logic for textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

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
        textareaRef.current &&
        !textareaRef.current.contains(target) &&
        pickerRef.current &&
        !pickerRef.current.contains(target)
      ) {
        onPickerOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen, onPickerOpenChange]);

  const removeTriggerFromInput = (triggerStr: string) => {
    const target = textareaRef.current;
    if (!target) return;
    
    const value = target.value;
    const selectionStart = target.selectionStart;
    const textBeforeCursor = value.slice(0, selectionStart);
    
    // Find the trigger word (e.g. "@", "@some", "/co")
    const lastWordMatch = textBeforeCursor.match(new RegExp(`(?:\\s|^)(\\${triggerStr}\\S*)$`));
    if (lastWordMatch) {
      // Find the exact index of the trigger
      const word = lastWordMatch[1];
      const matchIndex = textBeforeCursor.lastIndexOf(word);
      const newValue = value.slice(0, matchIndex) + value.slice(selectionStart);
      setInputValue(newValue);
      onInputChange?.(newValue);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = matchIndex;
          textareaRef.current.selectionEnd = matchIndex;
        }
      }, 0);
    }
  };

  const handlePickerSelect = (tab: TabInfo) => {
    onSelectTab(tab.id);
    onPickerOpenChange(false);
    removeTriggerFromInput('@');
    textareaRef.current?.focus();
  };

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

    // Submit on Enter (without Shift) when no picker is open
    if (e.key === 'Enter' && !e.shiftKey && !isPickerOpen && !isCommandPickerOpen) {
      e.preventDefault();
      handleSend();
      return;
    }
  };

  const customCommands: Command[] = useMemo(() => {
    return (customSlashCommands ?? []).map(cmd => ({
      name: `custom-${cmd.id}`,
      label: `/${cmd.name}`,
      description: cmd.description || cmd.prompt.slice(0, 60) + (cmd.prompt.length > 60 ? '...' : ''),
      text: cmd.prompt,
    }));
  }, [customSlashCommands]);

  const handleCommandSelect = (command: Command) => {
    setInputValue(command.text);
    onInputChange?.(command.text);
    setIsCommandPickerOpen(false);
    setCommandFilter('');
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = command.text.length;
        textareaRef.current.selectionEnd = command.text.length;
      }
    }, 0);
  };

  const handleCommandSelectAndSend = (command: Command) => {
    setIsCommandPickerOpen(false);
    setCommandFilter('');
    
    // Include the tab references in the user message text for visibility
    let finalText = command.text;
    if (selectedTabs.length > 0) {
      const tabMentions = selectedTabs.map(t => `@[${t.title}]`).join(' ');
      finalText = finalText ? `${finalText}\n\n${tabMentions}` : tabMentions;
    }

    // Pass empty array for tabIds so App.tsx uses its full tabSelection state (including active tab)
    onSend(finalText, []);
    setInputValue('');
    onInputChange?.('');
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    setInputValue(value);
    onInputChange?.(value);

    const selectionStart = target.selectionStart;
    const textBeforeCursor = value.slice(0, selectionStart);

    // Check for @ or / trigger
    const lastWordMatch = textBeforeCursor.match(/(?:\s|^)([@/])(\S*)$/);
    if (lastWordMatch) {
      const trigger = lastWordMatch[1];
      const filter = lastWordMatch[2];
      
      if (trigger === '@') {
        setTabFilter(filter);
        onPickerOpenChange(true);
        setIsCommandPickerOpen(false);
      } else if (trigger === '/') {
        setCommandFilter(filter);
        setIsCommandPickerOpen(true);
        onPickerOpenChange(false);
      }
    } else {
      onPickerOpenChange(false);
      setIsCommandPickerOpen(false);
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    
    if (!text && selectedTabs.length === 0 && !includeActiveTab) return;

    // Include the tab references in the user message text for visibility
    let finalText = text;
    if (selectedTabs.length > 0) {
      const tabMentions = selectedTabs.map(t => `@[${t.title}]`).join(' ');
      finalText = text ? `${text}\n\n${tabMentions}` : tabMentions;
    }

    // Pass empty array for tabIds so App.tsx uses its full tabSelection state
    onSend(finalText, []);

    // Clear input
    setInputValue('');
    onInputChange?.('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleAtClick = () => {
    onPickerOpenChange(true);
    textareaRef.current?.focus();
  };

  const handleSlashClick = () => {
    setInputValue('/');
    onInputChange?.('/');
    setCommandFilter('');
    setIsCommandPickerOpen(true);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = 1;
        textareaRef.current.selectionEnd = 1;
      }
    }, 0);
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
            extraCommands={customCommands}
          />

          {/* Input area with inline Send button */}
          <div className="relative min-w-0 flex flex-col bg-background dark:bg-background-dark border border-border dark:border-border-dark rounded-lg focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1">
            {/* Pill Container for Context inside the input area */}
            {selectedTabs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 pb-0">
                {selectedTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs max-w-full',
                      'bg-accent-subtle text-accent border border-accent/20',
                      'dark:bg-accent-subtle-dark dark:text-accent-dark dark:border-accent-dark/20'
                    )}
                  >
                    <span className="truncate max-w-[150px]">{tab.title}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveTab(tab.id)}
                      className="hover:opacity-70 focus:outline-none flex-shrink-0"
                      aria-label="Remove tab context"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="relative w-full min-w-0">
              <textarea
                ref={textareaRef}
                disabled={disabled}
                value={inputValue}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                rows={1}
                className={cn(
                  'w-full min-h-[40px] max-h-[200px] overflow-y-auto min-w-0 resize-none',
                  'px-3 py-2 pr-10 rounded-lg',
                  'bg-transparent text-sm text-text-primary',
                  'focus:outline-none',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'placeholder:text-text-tertiary dark:placeholder:text-text-tertiary-dark',
                  'dark:text-text-primary-dark',
                  'break-words'
                )}
                placeholder="Type a message, @ for tabs, / for commands"
                aria-label="Message input"
              />

              {/* Send/Stop button - positioned inside input, on the right */}
              {isStreaming && onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  className={cn(
                    'absolute right-1.5 bottom-1 p-1.5 rounded-md transition-colors',
                    'text-red-500 hover:bg-red-50',
                    'dark:text-red-400 dark:hover:bg-red-950'
                  )}
                  title="Stop generation"
                  aria-label="Stop generation"
                >
                  <StopCircle size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={disabled || (!inputValue.trim() && selectedTabs.length === 0)}
                  className={cn(
                    'absolute right-1.5 bottom-1.5 p-1.5 rounded-md transition-colors',
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
              )}
            </div>
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
