interface ThinkingBlockProps {
  thinking: string;
}

export default function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  return (
    <details className="mb-2 border border-gray-300 rounded-lg bg-gray-50">
      <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-t-lg select-none flex items-center gap-1">
        <svg
          className="w-4 h-4 transition-transform duration-200 [details[open]>&]:rotate-90"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        Show thinking
      </summary>
      <div className="px-3 py-2 text-sm text-gray-600 border-t border-gray-200 whitespace-pre-wrap">
        {thinking}
      </div>
    </details>
  );
}
