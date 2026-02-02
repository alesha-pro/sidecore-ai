/**
 * HTML to Markdown conversion utility
 * Mirrors the content script extraction pipeline using Readability + Turndown
 */

import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { normalizeMarkdown } from '../../shared/extraction';

export interface ConversionResult {
  title: string;
  markdown: string;
  textLength: number;
}

/**
 * Convert HTML string to Markdown using Readability + Turndown
 * Falls back to raw text extraction if Readability fails
 *
 * @param html - The HTML string to convert
 * @param sourceUrl - Optional URL for the document base (helps with relative links)
 */
export function convertHtmlToMarkdown(html: string, sourceUrl?: string): ConversionResult {
  // Parse HTML into a Document
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Set base URL if provided (helps Readability with relative links)
  if (sourceUrl) {
    const base = doc.createElement('base');
    base.href = sourceUrl;
    doc.head.appendChild(base);
  }

  // Clone document for Readability (it modifies the DOM)
  const docClone = doc.cloneNode(true) as Document;

  // Try Readability first
  const reader = new Readability(docClone);
  const article = reader.parse();

  // Configure Turndown
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  if (article && article.content) {
    // Readability succeeded - convert article content
    const markdown = normalizeMarkdown(turndownService.turndown(article.content));

    return {
      title: article.title || extractFallbackTitle(doc),
      markdown,
      textLength: markdown.length,
    };
  }

  // Fallback: extract raw text from body
  const bodyText = doc.body?.textContent || '';
  const title = extractFallbackTitle(doc);

  // For fallback, we still try to preserve some structure
  // by converting the entire body HTML
  const fallbackMarkdown = normalizeMarkdown(
    turndownService.turndown(doc.body?.innerHTML || bodyText)
  );

  return {
    title,
    markdown: fallbackMarkdown,
    textLength: fallbackMarkdown.length,
  };
}

/**
 * Extract title from document using common patterns
 */
function extractFallbackTitle(doc: Document): string {
  // Try <title> tag
  const titleEl = doc.querySelector('title');
  if (titleEl?.textContent) {
    return titleEl.textContent.trim();
  }

  // Try og:title
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const content = ogTitle.getAttribute('content');
    if (content) return content.trim();
  }

  // Try first h1
  const h1 = doc.querySelector('h1');
  if (h1?.textContent) {
    return h1.textContent.trim();
  }

  return 'Untitled';
}
