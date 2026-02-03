import { AtSign, Slash, ChevronDown, Settings, Sparkles } from 'lucide-preact';
import { cn } from '../lib/utils';

interface InputToolbarProps {
  currentModel: string;
  onModelClick: () => void;
  onAtClick: () => void;
  onSlashClick: () => void;
  onSettingsClick: () => void;
  disabled?: boolean;
  includeActiveTab?: boolean;
  onActiveTabChange?: (included: boolean) => void;
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

export function InputToolbar({
  currentModel,
  onModelClick,
  onAtClick,
  onSlashClick,
  onSettingsClick,
  disabled = false,
  includeActiveTab = false,
  onActiveTabChange,
}: InputToolbarProps) {
  const shortName = getShortModelName(currentModel);

  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-1.5 text-xs',
      'bg-surface border-t border-border',
      'dark:bg-surface-dark dark:border-border-dark'
    )}>
      {/* Left side: Model, @, /, Current Tab */}
      <div className="flex items-center gap-1">
        {/* Model button */}
        <button
          type="button"
          onClick={onModelClick}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark dark:focus-visible:ring-accent-dark',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title={`Current model: ${currentModel}`}
        >
          <Sparkles size={16} />
          <span className="font-medium">{shortName}</span>
          <ChevronDown size={14} />
        </button>

        {/* @ button */}
        <button
          type="button"
          onClick={onAtClick}
          disabled={disabled}
          className={cn(
            'p-1.5 rounded transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark dark:focus-visible:ring-accent-dark',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Add tab context (@)"
        >
          <AtSign size={16} />
        </button>

        {/* / button */}
        <button
          type="button"
          onClick={onSlashClick}
          disabled={disabled}
          className={cn(
            'p-1.5 rounded transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark dark:focus-visible:ring-accent-dark',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Commands (/)"
        >
          <Slash size={16} />
        </button>

        {/* Current Tab checkbox */}
        {onActiveTabChange && (
          <label className={cn(
            'flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none',
            'text-text-secondary hover:text-text-primary',
            'dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
          )}>
            <input
              type="checkbox"
              checked={includeActiveTab}
              disabled={disabled}
              onChange={(e) => onActiveTabChange((e.target as HTMLInputElement).checked)}
              className={cn(
                'h-3.5 w-3.5 rounded-full border',
                'text-accent border-border',
                'focus:ring-2 focus:ring-accent focus:ring-offset-1',
                'dark:text-accent-dark dark:border-border-dark dark:bg-surface-dark dark:focus:ring-accent-dark',
                'disabled:opacity-50'
              )}
            />
            <span className="text-xs">Current Tab</span>
          </label>
        )}
      </div>

      {/* Right side: Settings gear only */}
      <button
        type="button"
        onClick={onSettingsClick}
        disabled={disabled}
        className={cn(
          'p-1.5 rounded transition-colors',
          'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark dark:focus-visible:ring-accent-dark',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </div>
  );
}
