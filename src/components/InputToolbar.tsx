interface InputToolbarProps {
  currentModel: string;
  onModelClick: () => void;
  onAtClick: () => void;
  onSlashClick: () => void;
  disabled?: boolean;
}

// Extract short model name for display
function getShortModelName(model: string): string {
  // Common patterns to shorten
  const parts = model.split('/');
  const name = parts[parts.length - 1];

  // Shorten common model names
  if (name.includes('gpt-4o-mini')) return '4o Mini';
  if (name.includes('gpt-4o')) return '4o';
  if (name.includes('gpt-4-turbo')) return '4 Turbo';
  if (name.includes('gpt-4')) return 'GPT-4';
  if (name.includes('gpt-3.5')) return '3.5';
  if (name.includes('claude-3-opus')) return 'Opus';
  if (name.includes('claude-3-sonnet')) return 'Sonnet';
  if (name.includes('claude-3-haiku')) return 'Haiku';
  if (name.includes('claude-3.5-sonnet')) return '3.5 Sonnet';
  if (name.includes('claude-3.5-haiku')) return '3.5 Haiku';
  if (name.includes('deepseek')) return 'DeepSeek';
  if (name.includes('gemini-pro')) return 'Gemini';
  if (name.includes('gemini-1.5-pro')) return 'Gemini 1.5';
  if (name.includes('gemini-1.5-flash')) return 'Flash';
  if (name.includes('llama')) return 'Llama';
  if (name.includes('mixtral')) return 'Mixtral';
  if (name.includes('mistral')) return 'Mistral';

  // Default: take first 12 chars
  return name.length > 12 ? name.slice(0, 12) + '…' : name;
}

// Simple model icon (sparkle/brain icon)
function ModelIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

export function InputToolbar({
  currentModel,
  onModelClick,
  onAtClick,
  onSlashClick,
  disabled = false,
}: InputToolbarProps) {
  const shortName = getShortModelName(currentModel);

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-white border-t border-gray-100 text-sm">
      {/* Left side: Model selector + @ + / */}
      <div className="flex items-center gap-1">
        {/* Model button */}
        <button
          type="button"
          onClick={onModelClick}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Current model: ${currentModel}`}
        >
          <ModelIcon />
          <span className="text-xs font-medium">{shortName}</span>
        </button>

        {/* @ button */}
        <button
          type="button"
          onClick={onAtClick}
          disabled={disabled}
          className="px-2 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add tab context (@)"
        >
          <span className="text-sm font-medium">@</span>
        </button>

        {/* / button */}
        <button
          type="button"
          onClick={onSlashClick}
          disabled={disabled}
          className="px-2 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Commands (/)"
        >
          <span className="text-sm font-medium">/</span>
        </button>
      </div>

      {/* Right side: Enter hint */}
      <div className="text-xs text-gray-400">
        Enter ↵
      </div>
    </div>
  );
}
