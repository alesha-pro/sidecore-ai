/**
 * Injected article extractor - executes in page context to extract article content
 *
 * This script is injected on-demand via chrome.scripting.executeScript and exposes
 * a global function window.__extractArticle that returns structured article content
 * or structured errors.
 *
 * WXT Content Script Configuration: matches array uses a never-matching domain to prevent
 * auto-injection while satisfying WXT's dev mode requirement for at least one match pattern.
 * This will be manually injected via chrome.scripting.executeScript when needed.
 */

import { Readability, isProbablyReaderable } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { ArticleExtractionPayload } from '../shared/extraction';

/**
 * Site-specific handler interface
 * Handlers prepare the DOM before Readability extraction
 */
type SiteHandler = (doc: Document) => void;

/**
 * Site handlers registry
 * Each handler receives a cloned document and can modify it before Readability runs
 */
const siteHandlers: Record<string, SiteHandler> = {
  /**
   * Reddit handler - removes AI-generated "Related Answers" and sidebar content
   * that Readability incorrectly prioritizes over the actual post content
   */
  'reddit.com': (doc: Document) => {
    // Remove all aside elements (sidebars, related answers, ads, etc.)
    const asides = doc.querySelectorAll('aside');
    asides.forEach(el => el.remove());

    // Remove elements with complementary role (another way sidebars are marked)
    const complementary = doc.querySelectorAll('[role="complementary"]');
    complementary.forEach(el => el.remove());

    // Remove right sidebar container specifically
    const rightSidebar = doc.querySelector('#right-sidebar-container');
    rightSidebar?.remove();

    // Remove promoted/ad content
    const promoted = doc.querySelectorAll('[data-testid="promoted-link"], [data-testid="ad-slot"]');
    promoted.forEach(el => el.remove());

    console.log('[article-extractor] Reddit handler: removed', asides.length, 'aside elements');
  },

  /**
   * Twitter/X handler - focuses on tweet content
   */
  'twitter.com': (doc: Document) => {
    // Remove trending sidebar, who to follow, etc.
    const sidebar = doc.querySelector('[data-testid="sidebarColumn"]');
    sidebar?.remove();

    // Remove bottom bar
    const bottomBar = doc.querySelector('[data-testid="BottomBar"]');
    bottomBar?.remove();
  },

  /**
   * X.com handler (same as Twitter)
   */
  'x.com': (doc: Document) => {
    siteHandlers['twitter.com'](doc);
  },
};

/**
 * Get the appropriate site handler for a hostname
 */
function getSiteHandler(hostname: string): SiteHandler | null {
  // Direct match
  if (siteHandlers[hostname]) {
    return siteHandlers[hostname];
  }

  // Check for subdomain matches (e.g., www.reddit.com -> reddit.com)
  for (const domain of Object.keys(siteHandlers)) {
    if (hostname.endsWith('.' + domain) || hostname === domain) {
      return siteHandlers[domain];
    }
  }

  return null;
}

export default defineContentScript({
  matches: ['https://never-match-this-domain-wxt-dev-mode.invalid/*'],  // Never-matching pattern for WXT dev mode compatibility
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
    const url = document.location.href;
    const isReaderable = isProbablyReaderable(document);

    console.log('[article-extractor] Starting extraction:', {
      url,
      isReaderable,
      title: document.title,
      bodyTextLength: document.body?.innerText?.length || 0
    });

    // Clone document to avoid modifying the live page
    const documentClone = document.cloneNode(true) as Document;

    // Apply site-specific preprocessing if available
    const hostname = document.location.hostname;
    const siteHandler = getSiteHandler(hostname);
    if (siteHandler) {
      console.log('[article-extractor] Applying site handler for:', hostname);
      siteHandler(documentClone);
    }

    // Parse article content with Readability
    // We try extraction even if isProbablyReaderable is false (fallback)
    const reader = new Readability(documentClone);
    const article = reader.parse();

    console.log('[article-extractor] Readability result:', {
      success: !!article,
      title: article?.title,
      contentLength: article?.content?.length || 0
    });

    if (!article) {
      console.log('[article-extractor] Failed: no article extracted');
      return {
        readerable: false,
        error: {
          type: 'parse_failed',
          message: `Readability could not extract content from this page (isReaderable: ${isReaderable})`,
        },
      };
    }

    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    const markdown = turndownService.turndown(article.content);

    console.log('[article-extractor] Success:', {
      title: article.title,
      markdownLength: markdown.length
    });

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
