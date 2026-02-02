import { useState } from 'preact/hooks';

interface ModelSelectorProps {
  currentModel: string;
  savedModels: string[];
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  currentModel,
  savedModels,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');

  // Deduplicate: combine currentModel with savedModels
  const allModels = Array.from(
    new Set([currentModel, ...savedModels].filter(m => m.trim()))
  );

  const handleSelectChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const value = target.value;

    if (value === '__custom__') {
      setIsCustomMode(true);
      setCustomInput('');
    } else if (value) {
      onModelChange(value);
    }
  };

  const handleCustomSave = () => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onModelChange(trimmed);
      setIsCustomMode(false);
      setCustomInput('');
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

  const handleCustomBlur = () => {
    // Save on blur if input has content
    if (customInput.trim()) {
      handleCustomSave();
    } else {
      setIsCustomMode(false);
    }
  };

  if (isCustomMode) {
    return (
      <div className="px-4 py-2 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onInput={(e) => setCustomInput((e.target as HTMLInputElement).value)}
            onKeyDown={handleCustomKeyDown}
            onBlur={handleCustomBlur}
            placeholder="Enter model name..."
            autoFocus
            disabled={disabled}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleCustomSave}
            disabled={disabled || !customInput.trim()}
            className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false);
              setCustomInput('');
            }}
            disabled={disabled}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-white border-t border-gray-200">
      <div className="flex items-center gap-2">
        <label htmlFor="model-selector" className="text-xs text-gray-500 whitespace-nowrap">
          Model:
        </label>
        <select
          id="model-selector"
          value={currentModel}
          onChange={handleSelectChange}
          disabled={disabled}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
        >
          {allModels.length === 0 && (
            <option value="">No model selected</option>
          )}
          {allModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value="__custom__">+ Add custom model...</option>
        </select>
      </div>
    </div>
  );
}
