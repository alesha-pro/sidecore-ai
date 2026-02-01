/**
 * Background extraction orchestration with budget enforcement
 *
 * Handles on-demand tab extraction via chrome.scripting.executeScript with:
 * - Restricted URL guards (chrome://, edge://, webstore)
 * - Deterministic budget enforcement (active tab first, then by index)
 * - Per-tab error tracking
 * - Attribution headers (title + URL) per tab
 */

import type { TabInfo } from '../../lib/tabs';
import type {
  ExtractedTabContent,
  ArticleExtractionPayload,
  ExtractionError,
} from '../../shared/extraction';
import { normalizeMarkdown } from '../../shared/extraction';

/**
 * Restricted URL patterns that cannot be injected
 */
const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^edge:\/\//,
  /^https:\/\/chrome\.google\.com\/webstore/,
  /^https:\/\/chromewebstore\.google\.com/,
];

/**
 * Check if URL is restricted for content script injection
 */
function isRestrictedUrl(url: string): boolean {
  return RESTRICTED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extract content from multiple tabs with budget enforcement
 *
 * @param tabs - Tabs to extract (must include id, title, url, active, index)
 * @param budget - Maximum characters across all tabs
 * @returns ExtractedTabContent[] with per-tab errors and truncation flags
 */
export async function extractTabs(
  tabs: TabInfo[],
  budget: number
): Promise<ExtractedTabContent[]> {
  // First pass: extract all tabs (in parallel for speed)
  const extractions = await Promise.all(
    tabs.map(async (tab): Promise<ExtractedTabContent> => {
      // Guard restricted URLs
      if (isRestrictedUrl(tab.url)) {
        return {
          tabId: tab.id,
          title: tab.title,
          url: tab.url,
          markdown: '',
          truncated: false,
          error: {
            type: 'restricted',
            message: 'Cannot extract from restricted page (chrome://, webstore, etc.)',
          },
        };
      }

      try {
        // Inject article extractor script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/article-extractor.js'],
        });

        // Execute extraction and capture result
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            if (typeof window.__extractArticle === 'function') {
              return window.__extractArticle();
            }
            return {
              readerable: false,
              error: {
                type: 'injection_failed' as const,
                message: 'Extractor script not loaded',
              },
            };
          },
        });

        const payload = result.result as ArticleExtractionPayload;

        // Handle extraction errors
        if (!payload.readerable || payload.error) {
          return {
            tabId: tab.id,
            title: tab.title,
            url: tab.url,
            markdown: '',
            truncated: false,
            error: payload.error || {
              type: 'unknown',
              message: 'Unknown extraction error',
            },
          };
        }

        // Normalize markdown and add attribution header
        const normalizedMarkdown = normalizeMarkdown(payload.markdown || '');
        const attribution = `# ${payload.title || tab.title}\nSource: ${payload.url || tab.url}\n\n`;
        const fullMarkdown = attribution + normalizedMarkdown;

        return {
          tabId: tab.id,
          title: payload.title || tab.title,
          url: payload.url || tab.url,
          markdown: fullMarkdown,
          truncated: false,
        };
      } catch (error) {
        return {
          tabId: tab.id,
          title: tab.title,
          url: tab.url,
          markdown: '',
          truncated: false,
          error: {
            type: 'injection_failed',
            message: error instanceof Error ? error.message : 'Script injection failed',
            details: error,
          },
        };
      }
    })
  );

  // Second pass: apply deterministic budget
  // Active tab first, then remaining tabs sorted by index ascending
  const activeTab = extractions.find((e) => tabs.find((t) => t.id === e.tabId)?.active);
  const otherTabs = extractions
    .filter((e) => !tabs.find((t) => t.id === e.tabId)?.active)
    .sort((a, b) => {
      const aIndex = tabs.find((t) => t.id === a.tabId)?.index ?? 0;
      const bIndex = tabs.find((t) => t.id === b.tabId)?.index ?? 0;
      return aIndex - bIndex;
    });

  const orderedExtractions = activeTab ? [activeTab, ...otherTabs] : otherTabs;

  let remaining = budget;
  const budgetedResults: ExtractedTabContent[] = [];

  for (const extraction of orderedExtractions) {
    // Skip tabs with errors (include in results but don't count against budget)
    if (extraction.error) {
      budgetedResults.push(extraction);
      continue;
    }

    const markdownLength = extraction.markdown.length;

    if (markdownLength <= remaining) {
      // Fits within budget
      budgetedResults.push(extraction);
      remaining -= markdownLength;
    } else if (remaining > 0) {
      // Partial fit - truncate
      budgetedResults.push({
        ...extraction,
        markdown: extraction.markdown.slice(0, remaining),
        truncated: true,
      });
      remaining = 0;
    } else {
      // No budget left - include as truncated with empty content
      budgetedResults.push({
        ...extraction,
        markdown: '',
        truncated: true,
      });
    }
  }

  return budgetedResults;
}
