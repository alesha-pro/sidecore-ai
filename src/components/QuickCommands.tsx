interface QuickCommandsProps {
  onCommandSelect: (text: string) => void;
  disabled?: boolean;
}

const QUICK_COMMANDS = [
  { label: 'Summarize', text: 'Summarize this page in a few paragraphs' },
  { label: 'Translate', text: 'Translate the main content of this page' },
  { label: 'Explain', text: 'Explain the key concepts from this page in simple terms' },
  { label: 'Key Points', text: 'Extract the key points and main ideas from this page' },
];

export default function QuickCommands({ onCommandSelect, disabled = false }: QuickCommandsProps) {
  return (
    <div className="px-4 pb-2 bg-white">
      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            type="button"
            onClick={() => onCommandSelect(cmd.text)}
            disabled={disabled}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cmd.label}
          </button>
        ))}
      </div>
    </div>
  );
}
