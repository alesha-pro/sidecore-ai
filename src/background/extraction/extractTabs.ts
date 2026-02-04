/**
 * Background extraction orchestration with budget enforcement
 *
 * Handles on-demand tab extraction via chrome.scripting.executeScript with:
 * - Restricted URL guards (chrome://, edge://, webstore)
 * - Fair-share budget enforcement with surplus redistribution
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

  // Fair-share budget enforcement with surplus redistribution
  // Separate error tabs (pass through) from content tabs (budgeted)
  const contentTabs = orderedExtractions.filter((e) => !e.error);
  const errorTabs = orderedExtractions.filter((e) => e.error);

  // If no content tabs, return all as-is
  if (contentTabs.length === 0) {
    return orderedExtractions;
  }

  // Calculate per-tab fair share
  const perTabBudget = Math.floor(budget / contentTabs.length);

  // First pass: allocate up to perTabBudget per tab, track surplus and tabs needing more
  let surplus = 0;
  const allocations: Array<{
    extraction: ExtractedTabContent;
    originalLength: number;
    allocated: number;
    needsMore: boolean;
  }> = [];

  for (const extraction of contentTabs) {
    const originalLength = extraction.markdown.length;

    if (originalLength <= perTabBudget) {
      // Fits within fair share - use full markdown, donate surplus
      allocations.push({
        extraction,
        originalLength,
        allocated: originalLength,
        needsMore: false,
      });
      surplus += perTabBudget - originalLength;
    } else {
      // Needs more than fair share - allocate perTabBudget for now
      allocations.push({
        extraction,
        originalLength,
        allocated: perTabBudget,
        needsMore: true,
      });
    }
  }

  // Second pass: redistribute surplus to tabs needing more (in order)
  for (const allocation of allocations) {
    if (!allocation.needsMore || surplus === 0) {
      continue;
    }

    const extraNeeded = allocation.originalLength - allocation.allocated;
    const extraGiven = Math.min(extraNeeded, surplus);

    allocation.allocated += extraGiven;
    surplus -= extraGiven;
  }

  // Build final budgeted results with truncation flags
  const budgetedContentTabs = allocations.map((allocation) => {
    const isTruncated = allocation.allocated < allocation.originalLength;

    return {
      ...allocation.extraction,
      markdown: allocation.extraction.markdown.slice(0, allocation.allocated),
      truncated: isTruncated,
    };
  });

  // Reconstruct original ordering by interleaving error tabs back
  const budgetedResults: ExtractedTabContent[] = [];
  let contentIndex = 0;
  let errorIndex = 0;

  for (const extraction of orderedExtractions) {
    if (extraction.error) {
      budgetedResults.push(errorTabs[errorIndex++]);
    } else {
      budgetedResults.push(budgetedContentTabs[contentIndex++]);
    }
  }

  return budgetedResults;
}
