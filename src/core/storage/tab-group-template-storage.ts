import type { TabGroupTemplate, TabGroupTemplateTab } from '@core/types/tab-group.types';
import type { ChromeGroupColor } from '@core/types/session.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';
import { guardAction, trackAction } from '@core/services/limits/limit-guard';
import { withStorageLock } from './storage-mutex';

const adapter = new ChromeLocalKeyAdapter<TabGroupTemplate>('tab_group_templates');

/** A live browser tab group, as read from chrome.tabGroups / chrome.tabs. */
export interface LiveGroupSnapshot {
  title: string;
  color: ChromeGroupColor;
  tabs: { url?: string; title?: string; favIconUrl?: string }[];
}

function sameTabs(a: TabGroupTemplateTab[], b: TabGroupTemplateTab[]): boolean {
  return a.length === b.length && a.every((tab, i) => tab.url === b[i].url && tab.title === b[i].title);
}

export class TabGroupTemplateStorage {
  static async getAll(): Promise<TabGroupTemplate[]> {
    const all = await adapter.getAll();
    return all.filter((t) => !t.deletedAt);
  }

  /**
   * Insert or update a template by key.
   * Preserves the original `savedAt` timestamp on update.
   */
  static async upsert(template: TabGroupTemplate): Promise<void> {
    await guardAction();
    await withStorageLock('tab_group_templates', async () => {
      const all = await adapter.getAll();
      const idx = all.findIndex((t) => t.key === template.key);
      const now = new Date().toISOString();
      const stamped: TabGroupTemplate = {
        ...template,
        updatedAt: now,
        dirty: true,
        deletedAt: null,
      };
      if (idx >= 0) {
        all[idx] = { ...stamped, savedAt: all[idx].savedAt };
      } else {
        all.push(stamped);
      }
      await adapter.setAll(all);
    });
    void trackAction();
  }

  /**
   * Mirror live browser tab groups into saved templates (keyed by title + color).
   * This is bookkeeping, not a user action, so it does not count against action
   * limits. Keeps `pinned` and `savedAt`, skips unchanged groups, and never brings
   * back a template the user deleted.
   */
  static syncLiveGroups(groups: LiveGroupSnapshot[]): Promise<void> {
    return withStorageLock('tab_group_templates', async () => {
      const all = await adapter.getAll();
      const indexByKey = new Map(all.map((t, i) => [t.key, i]));
      const now = new Date().toISOString();
      let changed = false;

      for (const group of groups) {
        if (!group.title || group.tabs.length === 0) continue;
        const key = `${group.title}-${group.color}`;
        const tabs = group.tabs.map((t) => ({
          url: t.url ?? '',
          title: t.title ?? '',
          favIconUrl: t.favIconUrl ?? '',
        }));

        const idx = indexByKey.get(key);
        if (idx === undefined) {
          indexByKey.set(key, all.length);
          all.push({
            key, title: group.title, color: group.color, tabs,
            savedAt: now, updatedAt: now, pinned: false, deletedAt: null, dirty: true,
          });
          changed = true;
        } else if (!all[idx].deletedAt && !sameTabs(all[idx].tabs, tabs)) {
          all[idx] = { ...all[idx], tabs, updatedAt: now, dirty: true };
          changed = true;
        }
      }

      if (changed) await adapter.setAll(all);
    });
  }

  static async delete(key: string): Promise<void> {
    await withStorageLock('tab_group_templates', async () => {
      const all = await adapter.getAll();
      const idx = all.findIndex((t) => t.key === key);
      if (idx < 0) return;
      await guardAction();
      const now = new Date().toISOString();
      all[idx] = {
        ...all[idx],
        deletedAt: now,
        updatedAt: now,
        dirty: true,
      };
      await adapter.setAll(all);
    });
    void trackAction();
  }

  static replaceAll(templates: TabGroupTemplate[]): Promise<void> {
    return withStorageLock('tab_group_templates', async () => {
      await adapter.setAll(templates);
    });
  }

  /** Hard-delete tombstones deleted before `beforeTs` (ISO). Returns the count purged. */
  static purgeDeleted(beforeTs: string): Promise<number> {
    return withStorageLock('tab_group_templates', async () => {
      const all = await adapter.getAll();
      const kept = all.filter((t) => !(t.deletedAt != null && t.deletedAt < beforeTs));
      const purged = all.length - kept.length;
      if (purged > 0) await adapter.setAll(kept);
      return purged;
    });
  }
}
