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
 * Site-specific extractor result
 */
interface SiteExtractorResult {
  title: string;
  html: string;
}

/**
 * Site-specific extractor interface
 * Returns HTML content directly, bypassing Readability entirely
 * Return null to fall back to Readability
 */
type SiteExtractor = (doc: Document) => SiteExtractorResult | null;

/**
 * Site extractors registry
 * Each extractor can fully replace Readability for specific sites
 */
const siteExtractors: Record<string, SiteExtractor> = {
  /**
   * Reddit extractor - directly extracts post and comments
   * Readability fails on Reddit because:
   * 1. AI-generated "Related Answers" sidebar gets prioritized
   * 2. Comments in shreddit-comment web components get ignored
   */
  'reddit.com': (doc: Document) => {
    // Get post title
    const titleEl = doc.querySelector('h1[id^="post-title"]');
    const title = titleEl?.textContent?.trim() || '';

    if (!title) {
      console.log('[article-extractor] Reddit: no post title found, falling back to Readability');
      return null;
    }

    // Get subreddit, author, time from shreddit-post attributes
    const postEl = doc.querySelector('shreddit-post');
    const subreddit = postEl?.getAttribute('subreddit-prefixed-name') || '';
    const author = postEl?.getAttribute('author') || '';
    const createdTimestamp = postEl?.getAttribute('created-timestamp') || '';

    // Format time as relative or date
    let time = '';
    if (createdTimestamp) {
      const date = new Date(createdTimestamp);
      time = date.toLocaleDateString();
    }

    // Get post content (text body) - use schema:articleBody for clean text
    const postBodyEl = doc.querySelector('[property="schema:articleBody"]') ||
                       doc.querySelector('shreddit-post-text-body');
    const postBody = postBodyEl?.textContent?.trim() || '';

    // Get comments
    const commentEls = doc.querySelectorAll('shreddit-comment');
    const comments: string[] = [];

    commentEls.forEach(comment => {
      const commentAuthor = comment.getAttribute('author') || 'Anonymous';
      // Get comment text - textContent includes the full content
      const commentText = comment.textContent?.trim() || '';

      // Clean up: remove author name from start if duplicated
      let cleanText = commentText;
      if (cleanText.startsWith(commentAuthor)) {
        cleanText = cleanText.slice(commentAuthor.length).trim();
      }
      // Remove timestamp patterns like "• 3 ч назад" or "• 2 hours ago"
      cleanText = cleanText.replace(/^[•·]\s*\d+\s*\S+\s*(назад|ago)?\s*/i, '').trim();

      if (cleanText) {
        comments.push(`<div class="comment"><strong>${commentAuthor}:</strong> ${cleanText}</div>`);
      }
    });

    // Build HTML structure
    const html = `
      <article>
        <header>
          <p><strong>${subreddit}</strong> • ${author} • ${time}</p>
        </header>
        <h1>${title}</h1>
        ${postBody ? `<div class="post-body">${postBody}</div>` : ''}
        ${comments.length > 0 ? `
          <h2>Comments (${comments.length})</h2>
          ${comments.join('\n')}
        ` : ''}
      </article>
    `;

    console.log('[article-extractor] Reddit extractor: extracted', {
      title,
      postBodyLength: postBody.length,
      commentsCount: comments.length
    });

    return { title, html };
  },
};

/**
 * Site-specific DOM preprocessor interface
 * Handlers prepare the DOM before Readability extraction (used when no custom extractor)
 */
type SiteHandler = (doc: Document) => void;

/**
 * Site handlers registry (DOM preprocessing before Readability)
 */
const siteHandlers: Record<string, SiteHandler> = {
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
 * Get the appropriate site extractor for a hostname
 */
function getSiteExtractor(hostname: string): SiteExtractor | null {
  // Direct match
  if (siteExtractors[hostname]) {
    return siteExtractors[hostname];
  }

  // Check for subdomain matches (e.g., www.reddit.com -> reddit.com)
  for (const domain of Object.keys(siteExtractors)) {
    if (hostname.endsWith('.' + domain) || hostname === domain) {
      return siteExtractors[domain];
    }
  }

  return null;
}

/**
 * Get the appropriate site handler for a hostname
 */
function getSiteHandler(hostname: string): SiteHandler | null {
  // Direct match
  if (siteHandlers[hostname]) {
    return siteHandlers[hostname];
  }

  // Check for subdomain matches
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
    const hostname = document.location.hostname;

    // Try site-specific extractor first (completely bypasses Readability)
    const siteExtractor = getSiteExtractor(hostname);
    if (siteExtractor) {
      console.log('[article-extractor] Trying site extractor for:', hostname);
      const extractorResult = siteExtractor(documentClone);

      if (extractorResult) {
        // Convert HTML to Markdown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        });

        const markdown = turndownService.turndown(extractorResult.html);

        console.log('[article-extractor] Site extractor success:', {
          title: extractorResult.title,
          markdownLength: markdown.length
        });

        return {
          title: extractorResult.title,
          url: document.location.href,
          markdown,
          readerable: true,
          textLength: markdown.length,
        };
      }
      // If extractor returns null, fall through to Readability
      console.log('[article-extractor] Site extractor returned null, falling back to Readability');
    }

    // Apply site-specific DOM preprocessing if available
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
