/**
 * Extraction error types for structured error handling
 */
export type ExtractionErrorType =
  | 'restricted'
  | 'injection_failed'
  | 'not_readerable'
  | 'parse_failed'
  | 'unknown';

/**
 * Structured extraction error
 */
export interface ExtractionError {
  type: ExtractionErrorType;
  message: string;
  details?: unknown;
}

/**
 * Extracted content from a tab (final format for UI/context building)
 */
export interface ExtractedTabContent {
  tabId: number;
  title: string;
  url: string;
  markdown: string;
  truncated: boolean;
  error?: ExtractionError;
}

/**
 * Raw payload from injected article extractor
 */
export interface ArticleExtractionPayload {
  title?: string;
  url?: string;
  markdown?: string;
  readerable: boolean;
  textLength?: number;
  error?: ExtractionError;
}

/**
 * Normalize markdown content: trim, collapse excessive blank lines, ensure final newline
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .trim()
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Ensure single final newline
    + '\n';
}
