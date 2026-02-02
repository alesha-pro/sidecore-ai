import { useState, useRef, useEffect } from 'preact/hooks';

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
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Deduplicate: combine currentModel with savedModels
  const allModels = Array.from(
    new Set([currentModel, ...savedModels].filter((m) => m.trim()))
  );

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
          setCustomInput('');
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
      setIsCustomMode(false);
      setCustomInput('');
      onClose();
    }
  };

  const handleCustomKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSave();
    } else if (e.key === 'Escape') {
      setIsCustomMode(false);
      setCustomInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20">
      <div
        ref={popupRef}
        className="w-full max-w-md mx-4 mb-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Select Model</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCustomSave}
                  disabled={!customInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomMode(false);
                  setCustomInput('');
                }}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                ← Back to list
              </button>
            </div>
          ) : (
            <ul className="py-1">
              {allModels.map((model) => (
                <li key={model}>
                  <button
                    type="button"
                    onClick={() => handleSelectModel(model)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                      model === currentModel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span className="truncate">{model}</span>
                    {model === currentModel && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
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
