import type { ThemeMode } from '@/lib/types';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: string;
}

const themeOptions: ThemeOption[] = [
  { mode: 'light', label: 'Light', icon: '☀️' },
  { mode: 'dark', label: 'Dark', icon: '🌙' },
  { mode: 'auto', label: 'Auto', icon: '💻' },
];

interface ThemeToggleProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/**
 * Three-way theme toggle for light, dark, and auto (system) modes
 */
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {

  return (
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-600 dark:text-gray-400 min-w-[60px]">Theme:</span>
      <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {themeOptions.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            class={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
              transition-colors duration-150
              ${value === mode
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }
            `}
            aria-label={`Switch to ${label} theme`}
            aria-pressed={value === mode}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
