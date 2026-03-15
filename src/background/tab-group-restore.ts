import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import type { ChromeGroupColor } from '@core/types/session.types';

// ── URL helpers ────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function jaccardSimilarity(urls1: string[], urls2: string[]): number {
  const set1 = new Set(urls1.map(normalizeUrl));
  const set2 = new Set(urls2.map(normalizeUrl));
  if (set1.size === 0 && set2.size === 0) return 0;
  let intersection = 0;
  for (const u of set1) {
    if (set2.has(u)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Called on `chrome.runtime.onStartup`. Waits for Chrome to fully restore
 * the previous session's tabs, then re-applies saved template names/colors to
 * live tab groups whose titles were reset to "" by Chrome on restart.
 *
 * Matching is done by Jaccard similarity on tab URLs (query params stripped).
 * Threshold: 0.4 — at least 40% URL overlap.
 * Greedy best-match: each template is assigned to at most one live group.
 */
export async function restoreTabGroupNamesOnStartup(): Promise<void> {
  // Give Chrome time to fully restore the previous session.
  await new Promise<void>((resolve) => setTimeout(resolve, 3000));

  try {
    const [chromeGroups, allTabs, savedTemplates] = await Promise.all([
      chrome.tabGroups.query({}),
      chrome.tabs.query({}),
      TabGroupTemplateStorage.getAll(),
    ]);

    if (chromeGroups.length === 0 || savedTemplates.length === 0) return;

    // Build tab URL list per group id
    const tabUrlsByGroup = new Map<number, string[]>();
    for (const tab of allTabs) {
      if (tab.groupId && tab.groupId > 0 && tab.url) {
        const arr = tabUrlsByGroup.get(tab.groupId) ?? [];
        arr.push(tab.url);
        tabUrlsByGroup.set(tab.groupId, arr);
      }
    }

    // Only attempt to restore groups that have no name (Chrome reset them)
    const unnamedGroups = chromeGroups.filter((g) => !g.title || g.title.trim() === '');
    if (unnamedGroups.length === 0) return;

    // Score every (unnamedGroup, savedTemplate) pair
    interface ScoredMatch {
      groupId: number;
      templateKey: string;
      title: string;
      color: ChromeGroupColor;
      score: number;
    }

    const scored: ScoredMatch[] = [];
    for (const group of unnamedGroups) {
      const liveUrls = tabUrlsByGroup.get(group.id) ?? [];
      if (liveUrls.length === 0) continue;
      for (const template of savedTemplates) {
        if (!template.title || template.title === 'Unnamed') continue;
        const templateUrls = template.tabs.map((t) => t.url).filter(Boolean);
        const score = jaccardSimilarity(liveUrls, templateUrls);
        if (score >= 0.4) {
          scored.push({
            groupId: group.id,
            templateKey: template.key,
            title: template.title,
            color: template.color,
            score,
          });
        }
      }
    }

    // Greedy best-match: sort descending, assign one-to-one
    scored.sort((a, b) => b.score - a.score);
    const usedGroups = new Set<number>();
    const usedTemplates = new Set<string>();

    for (const match of scored) {
      if (usedGroups.has(match.groupId) || usedTemplates.has(match.templateKey)) continue;
      try {
        await chrome.tabGroups.update(match.groupId, {
          title: match.title,
          color: match.color,
        });
        usedGroups.add(match.groupId);
        usedTemplates.add(match.templateKey);
      } catch {
        // Non-fatal: group may have been closed or moved
      }
    }
  } catch {
    // Non-fatal: startup restore is best-effort
  }
}
