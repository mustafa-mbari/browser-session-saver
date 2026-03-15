import type { TabGroupTemplate } from '@core/types/tab-group.types';

const STORAGE_KEY = 'tab_group_templates';

export class TabGroupTemplateStorage {
  static async getAll(): Promise<TabGroupTemplate[]> {
    return new Promise((resolve) =>
      chrome.storage.local.get(STORAGE_KEY, (r) =>
        resolve((r[STORAGE_KEY] as TabGroupTemplate[] | undefined) ?? []),
      ),
    );
  }

  /**
   * Insert or update a template by key.
   * Preserves the original `savedAt` timestamp on update.
   */
  static async upsert(template: TabGroupTemplate): Promise<void> {
    const all = await this.getAll();
    const idx = all.findIndex((t) => t.key === template.key);
    if (idx >= 0) {
      all[idx] = { ...template, savedAt: all[idx].savedAt };
    } else {
      all.push(template);
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: all });
  }

  static async delete(key: string): Promise<void> {
    const all = await this.getAll();
    await chrome.storage.local.set({
      [STORAGE_KEY]: all.filter((t) => t.key !== key),
    });
  }
}
