interface TabChipProps {
  tabId: number;
  title: string;
  onRemove: (tabId: number) => void;
}

export function TabChip({ tabId, title, onRemove }: TabChipProps) {
  const handleRemove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(tabId);
  };

  return (
    <span
      contentEditable={false}
      data-tab-id={tabId}
      className="inline-flex items-center px-2 py-0.5 mx-1 text-xs bg-blue-100 text-blue-800 rounded select-none align-baseline"
    >
      <span className="truncate max-w-[120px]" title={title}>
        {title}
      </span>
      <button
        type="button"
        onClick={handleRemove}
        className="ml-1 hover:text-blue-600 focus:outline-none"
        aria-label={`Remove ${title}`}
      >
        ×
      </button>
    </span>
  );
}
