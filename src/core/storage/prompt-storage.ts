import type { Prompt, PromptCategory, PromptFolder, PromptTag } from '@core/types/prompt.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';

const promptsAdapter = new ChromeLocalKeyAdapter<Prompt>('prompts');
const categoriesAdapter = new ChromeLocalKeyAdapter<PromptCategory>('prompt_categories');
const tagsAdapter = new ChromeLocalKeyAdapter<PromptTag>('prompt_tags');
const foldersAdapter = new ChromeLocalKeyAdapter<PromptFolder>('prompt_folders');

/** Migrate prompts that pre-date the `source` field by defaulting to 'local'. */
function migratePrompts(prompts: Prompt[]): Prompt[] {
  return prompts.map((p) =>
    p.source ? p : { ...p, source: 'local' as const },
  );
}

export const PromptStorage = {
  // ── Prompts ────────────────────────────────────────────────────────────

  async getAll(): Promise<Prompt[]> {
    const raw = await promptsAdapter.getAll();
    return migratePrompts(raw);
  },

  async save(prompt: Prompt): Promise<void> {
    const all = await promptsAdapter.getAll();
    const idx = all.findIndex((p) => p.id === prompt.id);
    if (idx >= 0) {
      all[idx] = prompt;
    } else {
      all.push(prompt);
    }
    await promptsAdapter.setAll(all);
  },

  async update(id: string, updates: Partial<Prompt>): Promise<void> {
    const all = await promptsAdapter.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      await promptsAdapter.setAll(all);
    }
  },

  async delete(id: string): Promise<void> {
    const all = await promptsAdapter.getAll();
    await promptsAdapter.setAll(all.filter((p) => p.id !== id));
  },

  async deleteAll(): Promise<void> {
    await promptsAdapter.setAll([]);
  },

  async trackUsage(id: string): Promise<void> {
    const all = await promptsAdapter.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        usageCount: all[idx].usageCount + 1,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await promptsAdapter.setAll(all);
    }
  },

  // ── Folders ────────────────────────────────────────────────────────────

  getFolders(): Promise<PromptFolder[]> {
    return foldersAdapter.getAll();
  },

  async saveFolder(folder: PromptFolder): Promise<void> {
    const all = await foldersAdapter.getAll();
    const idx = all.findIndex((f) => f.id === folder.id);
    if (idx >= 0) {
      all[idx] = folder;
    } else {
      all.push(folder);
    }
    await foldersAdapter.setAll(all);
  },

  async deleteFolder(id: string): Promise<void> {
    // Delete folder and move its child prompts to parent (or root)
    const [folders, prompts] = await Promise.all([
      foldersAdapter.getAll(),
      promptsAdapter.getAll(),
    ]);
    const folder = folders.find((f) => f.id === id);
    // Re-parent child folders to the deleted folder's parent
    const updatedFolders = folders
      .filter((f) => f.id !== id)
      .map((f) =>
        f.parentId === id
          ? { ...f, parentId: folder?.parentId }
          : f,
      );
    // Clear folderId on prompts in this folder
    const updatedPrompts = prompts.map((p) =>
      p.folderId === id ? { ...p, folderId: undefined } : p,
    );
    await Promise.all([
      foldersAdapter.setAll(updatedFolders),
      promptsAdapter.setAll(updatedPrompts),
    ]);
  },

  // ── Categories ──────────────────────────────────────────────────────────

  getCategories(): Promise<PromptCategory[]> {
    return categoriesAdapter.getAll();
  },

  async saveCategory(category: PromptCategory): Promise<void> {
    const all = await categoriesAdapter.getAll();
    const idx = all.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      all[idx] = category;
    } else {
      all.push(category);
    }
    await categoriesAdapter.setAll(all);
  },

  async deleteCategory(id: string): Promise<void> {
    const all = await categoriesAdapter.getAll();
    await categoriesAdapter.setAll(all.filter((c) => c.id !== id));
  },

  // ── Tags ────────────────────────────────────────────────────────────────

  getTags(): Promise<PromptTag[]> {
    return tagsAdapter.getAll();
  },

  async saveTag(tag: PromptTag): Promise<void> {
    const all = await tagsAdapter.getAll();
    const idx = all.findIndex((t) => t.id === tag.id);
    if (idx >= 0) {
      all[idx] = tag;
    } else {
      all.push(tag);
    }
    await tagsAdapter.setAll(all);
  },

  async deleteTag(id: string): Promise<void> {
    const all = await tagsAdapter.getAll();
    await tagsAdapter.setAll(all.filter((t) => t.id !== id));
  },
};
