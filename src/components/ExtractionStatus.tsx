/**
 * ExtractionStatus - Compact single-line extraction summary
 *
 * Shows extraction results count and status indicators.
 * Expandable to show per-tab details on click.
 */

import { useState } from 'preact/hooks';
import type { ExtractedTabContent } from '../shared/extraction';

interface ExtractionStatusProps {
  results: ExtractedTabContent[];
}

export function ExtractionStatus({ results }: ExtractionStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (results.length === 0) {
    return null;
  }

  const okCount = results.filter((r) => !r.error && !r.truncated).length;
  const truncatedCount = results.filter((r) => !r.error && r.truncated).length;
  const errorCount = results.filter((r) => r.error).length;

  return (
    <div className="border-b border-gray-200">
      {/* Compact header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-xs bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-gray-600">
          Extraction: {results.length} {results.length === 1 ? 'tab' : 'tabs'}
        </span>
        <div className="flex items-center gap-2">
          {okCount > 0 && (
            <span className="text-green-600">{okCount} OK</span>
          )}
          {truncatedCount > 0 && (
            <span className="text-yellow-600">{truncatedCount} truncated</span>
          )}
          {errorCount > 0 && (
            <span className="text-red-600">{errorCount} failed</span>
          )}
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 py-2 bg-white space-y-1 max-h-32 overflow-y-auto">
          {results.map((result) => (
            <div key={result.tabId} className="flex items-center gap-2 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  result.error
                    ? 'bg-red-500'
                    : result.truncated
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
              />
              <span className="truncate flex-1 text-gray-700" title={result.url}>
                {result.title}
              </span>
              {result.error && (
                <span className="text-red-500 flex-shrink-0">{result.error.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
