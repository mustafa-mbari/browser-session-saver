import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';
import { guardAction, trackAction } from '@core/services/limits/limit-guard';

const adapter = new ChromeLocalKeyAdapter<TabGroupTemplate>('tab_group_templates');

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
    void trackAction();
  }

  static async delete(key: string): Promise<void> {
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
    void trackAction();
  }

  static replaceAll(templates: TabGroupTemplate[]): Promise<void> {
    return adapter.setAll(templates);
  }
}
