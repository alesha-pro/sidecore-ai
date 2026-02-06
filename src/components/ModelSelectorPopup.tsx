import { useState, useRef, useEffect } from 'preact/hooks';
import { Check, Search } from 'lucide-preact';
import { cn } from '../lib/utils';

interface ModelSelectorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  savedModels: string[];
  onModelChange: (model: string) => void;
}

export function ModelSelectorPopup({
  isOpen,
  onClose,
  currentModel,
  savedModels,
  onModelChange,
}: ModelSelectorPopupProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Deduplicate: combine currentModel with savedModels
  const allModels = Array.from(
    new Set([currentModel, ...savedModels].filter((m) => m.trim()))
  );

  // Filter models by search query
  const filteredModels = searchQuery.trim()
    ? allModels.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
    : allModels;

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setIsCustomMode(false);
      setCustomInput('');
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Focus input when entering custom mode
  useEffect(() => {
    if (isCustomMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCustomMode]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCustomMode) {
          setIsCustomMode(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCustomMode, onClose]);

  const handleSelectModel = (model: string) => {
    onModelChange(model);
    onClose();
  };

  const handleCustomSave = () => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onModelChange(trimmed);
      onClose();
    }
  };

  const handleCustomKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSave();
    } else if (e.key === 'Escape') {
      setIsCustomMode(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20">
      <div
        ref={popupRef}
        className={cn(
          'w-full max-w-md mx-4 mb-4 overflow-hidden',
          'rounded-xl border border-border bg-surface shadow-xl',
          'dark:bg-surface-dark dark:border-border-dark'
        )}
      >
        <div className={cn(
          'px-4 py-3 border-b border-border flex items-center justify-between',
          'dark:border-border-dark'
        )}>
          <h3 className={cn(
            'text-sm font-medium',
            'text-text-primary dark:text-text-primary-dark'
          )}>Select Model</h3>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'text-text-tertiary hover:text-text-primary',
              'dark:text-text-tertiary-dark dark:hover:text-text-primary-dark'
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input - only in model list view */}
        {!isCustomMode && (
          <div className={cn(
            'px-3 py-2 border-b border-border',
            'dark:border-border-dark'
          )}>
            <div className="relative">
              <Search size={14} className={cn(
                'absolute left-2.5 top-1/2 -translate-y-1/2',
                'text-text-tertiary dark:text-text-tertiary-dark'
              )} />
              <input
                type="text"
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                placeholder="Search models..."
                className={cn(
                  'w-full pl-8 pr-3 py-1.5 text-sm rounded-md',
                  'border border-border bg-background text-text-primary',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark',
                  'placeholder:text-text-tertiary dark:placeholder:text-text-tertiary-dark'
                )}
                autoFocus
              />
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto">
          {isCustomMode ? (
            <div className="p-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={customInput}
                  onInput={(e) => setCustomInput((e.target as HTMLInputElement).value)}
                  onKeyDown={handleCustomKeyDown}
                  placeholder="Enter model name..."
                  className={cn(
                    'flex-1 px-3 py-2 text-sm rounded-lg',
                    'border border-border bg-background text-text-primary',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                  )}
                />
                <button
                  type="button"
                  onClick={handleCustomSave}
                  disabled={!customInput.trim()}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg',
                    'bg-accent text-white hover:opacity-90',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'dark:bg-accent-dark'
                  )}
                >
                  Add
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className={cn(
                  'mt-2 text-xs',
                  'text-text-secondary hover:text-text-primary',
                  'dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
                )}
              >
                ← Back to list
              </button>
            </div>
          ) : (
            <ul className="py-1">
              {filteredModels.map((model) => {
                const isSelected = model === currentModel;
                return (
                  <li key={model}>
                    <button
                      type="button"
                      onClick={() => handleSelectModel(model)}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm flex items-center justify-between',
                        'hover:bg-surface-hover',
                        'dark:hover:bg-surface-hover-dark',
                        isSelected && 'bg-accent-subtle dark:bg-accent-subtle-dark'
                      )}
                    >
                      <span className={cn(
                        'truncate',
                        'text-text-primary dark:text-text-primary-dark'
                      )}>{model}</span>
                      {isSelected && (
                        <Check size={16} className={cn(
                          'text-accent dark:text-accent-dark'
                        )} />
                      )}
                    </button>
                  </li>
                );
              })}
              {filteredModels.length === 0 && searchQuery.trim() && (
                <li className={cn(
                  'px-4 py-3 text-sm text-center',
                  'text-text-secondary dark:text-text-secondary-dark'
                )}>
                  No models matching "{searchQuery}"
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm flex items-center gap-2',
                    'text-accent hover:bg-accent-subtle',
                    'dark:text-accent-dark dark:hover:bg-accent-subtle-dark'
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add custom model...
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
