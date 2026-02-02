interface InputToolbarProps {
  currentModel: string;
  onModelClick: () => void;
  onAtClick: () => void;
  onSlashClick: () => void;
  onSettingsClick: () => void;
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

// Simple gear/cog icon for settings
function GearIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function InputToolbar({
  currentModel,
  onModelClick,
  onAtClick,
  onSlashClick,
  onSettingsClick,
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

      {/* Right side: Settings gear icon */}
      <button
        type="button"
        onClick={onSettingsClick}
        disabled={disabled}
        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Settings"
      >
        <GearIcon />
      </button>
    </div>
  );
}
