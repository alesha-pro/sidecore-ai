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
import { debugLog } from '../lib/debug';
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
type SiteExtractor = (doc: Document, url: string) => SiteExtractorResult | null;

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
  'reddit.com': (doc: Document, _url: string) => {
    // Get post title
    const titleEl = doc.querySelector('h1[id^="post-title"]');
    const title = titleEl?.textContent?.trim() || '';

    if (!title) {
      debugLog('[article-extractor] Reddit: no post title found, falling back to Readability');
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

    debugLog('[article-extractor] Reddit extractor: extracted', {
      title,
      postBodyLength: postBody.length,
      commentsCount: comments.length
    });

    return { title, html };
  },

  /**
   * X.com/Twitter extractor - structured extraction of tweets and replies
   * Handles both status pages (/status/) and timeline/feed pages (/home, profiles, etc.)
   */
  'x.com': (doc: Document, url: string) => {
    const articles = doc.querySelectorAll('article[data-testid="tweet"]');
    if (articles.length === 0) {
      debugLog('[article-extractor] X.com: no tweet articles found, falling back to Readability');
      return null;
    }

    function extractTweet(article: Element) {
      // Display name and handle from User-Name container
      const userNameEl = article.querySelector('[data-testid="User-Name"]');
      const userLinks = userNameEl?.querySelectorAll('a') || [];
      const displayName = userLinks[0]?.textContent?.trim() || '';
      // Handle: find link text starting with @
      let handle = '';
      for (const link of Array.from(userLinks)) {
        const text = link.textContent?.trim() || '';
        if (text.startsWith('@')) {
          handle = text;
          break;
        }
      }

      // Verified badge
      const verified = !!article.querySelector('[data-testid="icon-verified"]');

      // Tweet text
      const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
      const text = tweetTextEl?.textContent?.trim() || '';

      // Timestamp
      const timeEl = article.querySelector('time');
      const datetime = timeEl?.getAttribute('datetime') || '';
      let formattedTime = '';
      if (datetime) {
        const date = new Date(datetime);
        formattedTime = date.toISOString().replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, ' UTC');
      }

      // Metrics from aria-label on the group role element
      const metricsEl = article.querySelector('[role="group"][aria-label]');
      const metrics = metricsEl?.getAttribute('aria-label') || '';

      return { displayName, handle, verified, text, formattedTime, metrics };
    }

    const verifiedMark = (v: boolean) => v ? ' ✓' : '';
    const isStatusPage = url.includes('/status/');

    if (isStatusPage) {
      // Status page: first article = main tweet, rest = replies
      const mainTweet = extractTweet(articles[0]);
      const replies = Array.from(articles).slice(1).map(extractTweet);

      const title = `Tweet by ${mainTweet.displayName} (${mainTweet.handle})`;

      let html = `<article>`;
      html += `<h1>Tweet by ${mainTweet.displayName} (${mainTweet.handle})${verifiedMark(mainTweet.verified)}</h1>`;
      html += `<p>${mainTweet.formattedTime}${mainTweet.metrics ? ' | ' + mainTweet.metrics : ''}</p>`;
      html += `<p>${mainTweet.text}</p>`;

      if (replies.length > 0) {
        html += `<hr><h2>Replies</h2>`;
        for (const reply of replies) {
          html += `<h3>${reply.displayName} (${reply.handle})${verifiedMark(reply.verified)}</h3>`;
          html += `<p>${reply.formattedTime}${reply.metrics ? ' | ' + reply.metrics : ''}</p>`;
          html += `<p>${reply.text}</p>`;
          html += `<hr>`;
        }
      }

      html += `</article>`;

      debugLog('[article-extractor] X.com status extractor: extracted', {
        title,
        mainTweetLength: mainTweet.text.length,
        repliesCount: replies.length
      });

      return { title, html };
    } else {
      // Timeline/feed page: all articles are independent tweets
      const tweets = Array.from(articles).map(extractTweet).filter(t => t.text);

      if (tweets.length === 0) {
        debugLog('[article-extractor] X.com: no tweets with text found, falling back to Readability');
        return null;
      }

      const title = `X Timeline (${tweets.length} tweets)`;

      let html = `<article>`;
      html += `<h1>${title}</h1>`;
      for (const tweet of tweets) {
        html += `<h3>${tweet.displayName} (${tweet.handle})${verifiedMark(tweet.verified)}</h3>`;
        html += `<p>${tweet.formattedTime}${tweet.metrics ? ' | ' + tweet.metrics : ''}</p>`;
        html += `<p>${tweet.text}</p>`;
        html += `<hr>`;
      }
      html += `</article>`;

      debugLog('[article-extractor] X.com timeline extractor: extracted', {
        tweetsCount: tweets.length
      });

      return { title, html };
    }
  },

  'twitter.com': function(doc: Document, url: string) {
    return siteExtractors['x.com'](doc, url);
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

    debugLog('[article-extractor] Starting extraction:', {
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
      debugLog('[article-extractor] Trying site extractor for:', hostname);
      const extractorResult = siteExtractor(documentClone, url);

      if (extractorResult) {
        // Convert HTML to Markdown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        });

        const markdown = turndownService.turndown(extractorResult.html);

        debugLog('[article-extractor] Site extractor success:', {
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
      debugLog('[article-extractor] Site extractor returned null, falling back to Readability');
    }

    // Apply site-specific DOM preprocessing if available
    const siteHandler = getSiteHandler(hostname);
    if (siteHandler) {
      debugLog('[article-extractor] Applying site handler for:', hostname);
      siteHandler(documentClone);
    }

    // Parse article content with Readability
    // We try extraction even if isProbablyReaderable is false (fallback)
    const reader = new Readability(documentClone);
    const article = reader.parse();

    debugLog('[article-extractor] Readability result:', {
      success: !!article,
      title: article?.title,
      contentLength: article?.content?.length || 0
    });

    if (!article) {
      debugLog('[article-extractor] Failed: no article extracted');
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

    debugLog('[article-extractor] Success:', {
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
