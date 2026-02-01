/**
 * ExtractionStatus - Display per-tab extraction outcomes
 *
 * Shows compact list of extraction results with:
 * - Tab title + URL
 * - Error labels (red) for failed extractions
 * - Truncation warnings for budgeted tabs
 */

import type { ExtractedTabContent } from '../shared/extraction';

interface ExtractionStatusProps {
  results: ExtractedTabContent[];
}

export function ExtractionStatus({ results }: ExtractionStatusProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
      <div className="text-xs font-semibold text-blue-900 mb-2">
        Extraction Status ({results.length} {results.length === 1 ? 'tab' : 'tabs'})
      </div>
      <div className="space-y-1">
        {results.map((result) => (
          <div key={result.tabId} className="flex items-start gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {result.title}
              </div>
              <div className="text-gray-500 truncate">
                {result.url}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {result.error && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                  Error: {result.error.message}
                </span>
              )}
              {!result.error && result.truncated && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                  Truncated
                </span>
              )}
              {!result.error && !result.truncated && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  OK
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
