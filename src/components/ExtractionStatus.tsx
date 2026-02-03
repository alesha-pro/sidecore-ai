/**
 * ExtractionStatus - Compact single-line extraction summary
 *
 * Shows extraction results count and status indicators.
 * Expandable to show per-tab details on click.
 */

import { useState } from 'preact/hooks';
import { ChevronDown } from 'lucide-preact';
import { cn } from '../lib/utils';
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
    <div className={cn('border-b border-border', 'dark:border-border-dark')}>
      {/* Compact header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors',
          'bg-surface hover:bg-surface-hover',
          'dark:bg-surface-dark dark:hover:bg-surface-hover-dark'
        )}
      >
        <span className={cn('text-text-secondary', 'dark:text-text-secondary-dark')}>
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
          <ChevronDown
            size={12}
            className={cn(
              'transition-transform',
              'text-text-secondary',
              'dark:text-text-secondary-dark',
              isExpanded && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className={cn(
          'px-3 py-2 space-y-1 max-h-32 overflow-y-auto',
          'bg-background',
          'dark:bg-background-dark'
        )}>
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
              <span className={cn(
                'truncate flex-1',
                'text-text-primary',
                'dark:text-text-primary-dark'
              )} title={result.url}>
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
