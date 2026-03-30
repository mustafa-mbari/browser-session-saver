import type { TabGroupTemplate } from '@core/types/tab-group.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';

const adapter = new ChromeLocalKeyAdapter<TabGroupTemplate>('tab_group_templates');

export class TabGroupTemplateStorage {
  static getAll(): Promise<TabGroupTemplate[]> {
    return adapter.getAll();
  }

  /**
   * Insert or update a template by key.
   * Preserves the original `savedAt` timestamp on update.
   */
  static async upsert(template: TabGroupTemplate): Promise<void> {
    const all = await adapter.getAll();
    const idx = all.findIndex((t) => t.key === template.key);
    if (idx >= 0) {
      all[idx] = { ...template, savedAt: all[idx].savedAt };
    } else {
      all.push(template);
    }
    await adapter.setAll(all);
  }

  static async delete(key: string): Promise<void> {
    const all = await adapter.getAll();
    await adapter.setAll(all.filter((t) => t.key !== key));
  }

  static replaceAll(templates: TabGroupTemplate[]): Promise<void> {
    return adapter.setAll(templates);
  }
}
