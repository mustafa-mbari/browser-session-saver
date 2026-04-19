import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptStorage } from '@core/storage/prompt-storage';
import { withStorageLock } from '@core/storage/storage-mutex';
import type { Prompt, PromptFolder, PromptCategory, PromptTag } from '@core/types/prompt.types';

vi.mock('@core/services/limits/limit-guard', () => ({
  guardAction: vi.fn().mockResolvedValue(undefined),
  trackAction: vi.fn().mockResolvedValue(undefined),
  ActionLimitError: class ActionLimitError extends Error {},
}));



// Helper to build a minimal Prompt
function makePrompt(id: string, overrides: Partial<Prompt> = {}): Prompt {
  return {
    id,
    title: `Prompt ${id}`,
    content: `Content for ${id}`,
    tags: [],
    source: 'local',
    isFavorite: false,
    isPinned: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFolder(id: string, overrides: Partial<PromptFolder> = {}): PromptFolder {
  return {
    id,
    name: `Folder ${id}`,
    position: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Simulate chrome.storage.local as an in-memory store
function setupStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string, cb: (r: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    },
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    },
  );
  return store;
}

describe('PromptStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getAll ────────────────────────────────────────────────────────────────

  it('getAll returns empty array when storage is empty', async () => {
    setupStorage();
    const result = await PromptStorage.getAll();
    expect(result).toEqual([]);
  });

  it('getAll returns stored prompts', async () => {
    const prompts = [makePrompt('1'), makePrompt('2')];
    setupStorage({ prompts });
    const result = await PromptStorage.getAll();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
  });

  // ── save (upsert) ─────────────────────────────────────────────────────────

  it('save inserts a new prompt when id does not exist', async () => {
    setupStorage({ prompts: [] });
    const p = makePrompt('abc');
    await PromptStorage.save(p);
    const all = await PromptStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('abc');
  });

  it('save updates an existing prompt by id', async () => {
    const original = makePrompt('x', { title: 'Original' });
    setupStorage({ prompts: [original] });
    await PromptStorage.save({ ...original, title: 'Updated' });
    const all = await PromptStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Updated');
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it('delete removes the correct prompt', async () => {
    setupStorage({ prompts: [makePrompt('keep'), makePrompt('remove')] });
    await PromptStorage.delete('remove');
    const all = await PromptStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('keep');
  });

  it('delete on non-existent id leaves array unchanged', async () => {
    setupStorage({ prompts: [makePrompt('a')] });
    await PromptStorage.delete('z');
    const all = await PromptStorage.getAll();
    expect(all).toHaveLength(1);
  });

  // ── update ────────────────────────────────────────────────────────────────

  it('update applies partial changes and sets updatedAt', async () => {
    const p = makePrompt('u', { isFavorite: false });
    setupStorage({ prompts: [p] });
    await PromptStorage.update('u', { isFavorite: true });
    const all = await PromptStorage.getAll();
    expect(all[0].isFavorite).toBe(true);
  });

  it('update does nothing when id not found', async () => {
    setupStorage({ prompts: [makePrompt('a')] });
    await expect(PromptStorage.update('unknown', { title: 'X' })).resolves.toBeUndefined();
    const all = await PromptStorage.getAll();
    expect(all[0].title).toBe('Prompt a');
  });

  // ── trackUsage ────────────────────────────────────────────────────────────

  it('trackUsage increments usageCount and sets lastUsedAt', async () => {
    const p = makePrompt('t', { usageCount: 3 });
    setupStorage({ prompts: [p] });
    await PromptStorage.trackUsage('t');
    const all = await PromptStorage.getAll();
    expect(all[0].usageCount).toBe(4);
    expect(all[0].lastUsedAt).toBeDefined();
  });

  // ── Tags ──────────────────────────────────────────────────────────────────

  it('saveTag inserts a new tag', async () => {
    setupStorage({ prompt_tags: [] });
    await PromptStorage.saveTag({ id: 'tag1', name: 'GPT', color: '#f00' });
    const tags = await PromptStorage.getTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('GPT');
  });

  it('deleteTag removes the correct tag', async () => {
    setupStorage({ prompt_tags: [{ id: 'a', name: 'A', color: '#0f0' }, { id: 'b', name: 'B', color: '#00f' }] });
    await PromptStorage.deleteTag('a');
    const tags = await PromptStorage.getTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].id).toBe('b');
  });

  // ── Categories ────────────────────────────────────────────────────────────

  it('saveCategory inserts a new category', async () => {
    setupStorage({ prompt_categories: [] });
    const cat = { id: 'c1', name: 'Writing', icon: '✍️', color: '#6366f1', createdAt: '' };
    await PromptStorage.saveCategory(cat);
    const cats = await PromptStorage.getCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('Writing');
  });

  it('deleteCategory removes the correct category', async () => {
    const cats = [
      { id: 'c1', name: 'A', icon: '📁', color: '#000', createdAt: '' },
      { id: 'c2', name: 'B', icon: '📂', color: '#111', createdAt: '' },
    ];
    setupStorage({ prompt_categories: cats });
    await PromptStorage.deleteCategory('c1');
    const result = await PromptStorage.getCategories();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });
});

// ── Folders ────────────────────────────────────────────────────────────────

describe('PromptStorage — Folders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getFolders returns empty array when storage is empty', async () => {
    setupStorage();
    const result = await PromptStorage.getFolders();
    expect(result).toEqual([]);
  });

  it('saveFolder inserts a new folder', async () => {
    setupStorage({ prompt_folders: [] });
    await PromptStorage.saveFolder(makeFolder('f1'));
    const folders = await PromptStorage.getFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].id).toBe('f1');
  });

  it('saveFolder updates an existing folder by id', async () => {
    setupStorage({ prompt_folders: [makeFolder('f1', { name: 'Old' })] });
    await PromptStorage.saveFolder(makeFolder('f1', { name: 'New' }));
    const folders = await PromptStorage.getFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('New');
  });

  it('deleteFolder removes the folder', async () => {
    setupStorage({ prompt_folders: [makeFolder('f1'), makeFolder('f2')], prompts: [] });
    await PromptStorage.deleteFolder('f1');
    const folders = await PromptStorage.getFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].id).toBe('f2');
  });

  it('deleteFolder clears folderId on prompts assigned to that folder', async () => {
    setupStorage({
      prompt_folders: [makeFolder('f1')],
      prompts: [makePrompt('p1', { folderId: 'f1' }), makePrompt('p2')],
    });
    await PromptStorage.deleteFolder('f1');
    const prompts = await PromptStorage.getAll();
    expect(prompts.find((p) => p.id === 'p1')?.folderId).toBeUndefined();
    expect(prompts.find((p) => p.id === 'p2')?.folderId).toBeUndefined();
  });
});

// ── source field migration ─────────────────────────────────────────────────

describe('PromptStorage — source migration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getAll defaults source to local for prompts without source field', async () => {
    // Simulate old stored prompt without the source field
    const oldPrompt = {
      id: 'old',
      title: 'Old Prompt',
      content: 'content',
      tags: [],
      isFavorite: false,
      isPinned: false,
      usageCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      // no source field
    };
    setupStorage({ prompts: [oldPrompt] });
    const result = await PromptStorage.getAll();
    expect(result[0].source).toBe('local');
  });

  it('getAll preserves existing source field', async () => {
    setupStorage({ prompts: [makePrompt('a', { source: 'app' })] });
    const result = await PromptStorage.getAll();
    expect(result[0].source).toBe('app');
  });

  // ── setCategories lock compliance ───────────────────────────────────────

  describe('setCategories — lock compliance', () => {
    function makeCategory(id: string): PromptCategory {
      return { id, name: `Cat ${id}`, icon: '📁', color: '#000', createdAt: '2025-01-01T00:00:00.000Z' };
    }

    it('setCategories waits for in-flight locked operations on prompt_categories', async () => {
      setupStorage({ prompt_categories: [] });
      const order: string[] = [];

      let releaseLock!: () => void;
      const lockBarrier = new Promise<void>((res) => { releaseLock = res; });

      const lockHolder = withStorageLock('prompt_categories', async () => {
        order.push('lock_acquired');
        await lockBarrier;
        order.push('lock_released');
      });

      await Promise.resolve();
      await Promise.resolve();

      const setCatDone = PromptStorage.setCategories([makeCategory('new')]).then(() => {
        order.push('setCategories_done');
      });

      await Promise.resolve();
      await Promise.resolve();

      // FAILS before fix: setCategories bypasses the lock and runs immediately.
      expect(order).not.toContain('setCategories_done');

      releaseLock();
      await Promise.all([lockHolder, setCatDone]);

      expect(order).toEqual(['lock_acquired', 'lock_released', 'setCategories_done']);
    });
  });

  // ── setTags lock compliance ─────────────────────────────────────────────

  describe('setTags — lock compliance', () => {
    function makeTag(id: string): PromptTag {
      return { id, name: `tag-${id}`, color: '#000' };
    }

    it('setTags waits for in-flight locked operations on prompt_tags', async () => {
      setupStorage({ prompt_tags: [] });
      const order: string[] = [];

      let releaseLock!: () => void;
      const lockBarrier = new Promise<void>((res) => { releaseLock = res; });

      const lockHolder = withStorageLock('prompt_tags', async () => {
        order.push('lock_acquired');
        await lockBarrier;
        order.push('lock_released');
      });

      await Promise.resolve();
      await Promise.resolve();

      const setTagDone = PromptStorage.setTags([makeTag('new')]).then(() => {
        order.push('setTags_done');
      });

      await Promise.resolve();
      await Promise.resolve();

      // FAILS before fix: setTags bypasses the lock and runs immediately.
      expect(order).not.toContain('setTags_done');

      releaseLock();
      await Promise.all([lockHolder, setTagDone]);

      expect(order).toEqual(['lock_acquired', 'lock_released', 'setTags_done']);
    });
  });
});
