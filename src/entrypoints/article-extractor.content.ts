/**
 * Injected article extractor - executes in page context to extract article content
 *
 * This script is injected on-demand via chrome.scripting.executeScript and exposes
 * a global function window.__extractArticle that returns structured article content
 * or structured errors.
 *
 * WXT Content Script Configuration: matches array is empty to prevent auto-injection.
 * This will be manually injected via chrome.scripting.executeScript when needed.
 */

import { Readability, isProbablyReaderable } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { ArticleExtractionPayload } from '../shared/extraction';

export default defineContentScript({
  matches: [],  // Empty matches = never auto-inject, only manual injection
  main() {
    window.__extractArticle = extractArticle;
  },
});

/**
 * Extract article content from the current page using Readability and convert to Markdown
 *
 * Returns structured payload with either:
 * - Successful extraction: { title, url, markdown, readerable: true, textLength }
 * - Error payload: { readerable: false, error: { type, message } }
 */
function extractArticle(): ArticleExtractionPayload {
  try {
    // Check if page is probably readerable before processing
    if (!isProbablyReaderable(document)) {
      return {
        readerable: false,
        error: {
          type: 'not_readerable',
          message: 'Page does not appear to contain article content',
        },
      };
    }

    // Clone document to avoid modifying the live page
    const documentClone = document.cloneNode(true) as Document;

    // Parse article content with Readability
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (!article) {
      return {
        readerable: false,
        error: {
          type: 'parse_failed',
          message: 'Readability failed to extract article content',
        },
      };
    }

    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    const markdown = turndownService.turndown(article.content);

    return {
      title: article.title,
      url: document.location.href,
      markdown,
      readerable: true,
      textLength: markdown.length,
    };
  } catch (error) {
    return {
      readerable: false,
      error: {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown extraction error',
        details: error,
      },
    };
  }
}

// Type declaration for window global
declare global {
  interface Window {
    __extractArticle?: () => ArticleExtractionPayload;
  }
}
