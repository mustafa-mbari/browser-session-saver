import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import type { TabGroupTemplate } from '@core/types/tab-group.types';

vi.mock('@core/services/limits/limit-guard', () => ({
  guardAction: vi.fn().mockResolvedValue(undefined),
  trackAction: vi.fn().mockResolvedValue(undefined),
  ActionLimitError: class ActionLimitError extends Error {},
}));



let store: Record<string, unknown> = {};

function setupStorage(initial: Record<string, unknown> = {}) {
  store = { ...initial };

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
}

function makeTemplate(overrides: Partial<TabGroupTemplate> = {}): TabGroupTemplate {
  return {
    key: 'work-blue',
    title: 'Work',
    color: 'blue',
    tabs: [{ url: 'https://example.com', title: 'Example', favIconUrl: '' }],
    savedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TabGroupTemplateStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStorage();
  });

  // ── getAll ───────────────────────────────────────────────────────────────

  it('getAll returns empty array when no templates stored', async () => {
    expect(await TabGroupTemplateStorage.getAll()).toEqual([]);
  });

  it('getAll returns stored templates', async () => {
    setupStorage({ tab_group_templates: [makeTemplate()] });
    const result = await TabGroupTemplateStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('work-blue');
  });

  // ── upsert (insert) ───────────────────────────────────────────────────────

  it('upsert inserts a new template', async () => {
    await TabGroupTemplateStorage.upsert(makeTemplate());
    const result = await TabGroupTemplateStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Work');
  });

  // ── upsert (update) ───────────────────────────────────────────────────────

  it('upsert updates existing template but preserves savedAt', async () => {
    const original = makeTemplate({ savedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    setupStorage({ tab_group_templates: [original] });

    const before = new Date().toISOString();
    const updated = makeTemplate({
      title: 'Work Revised',
      savedAt: '2099-01-01T00:00:00.000Z', // should be ignored on update
      updatedAt: '2026-06-01T00:00:00.000Z', // ignored — upsert stamps now
    });
    await TabGroupTemplateStorage.upsert(updated);

    const result = await TabGroupTemplateStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Work Revised');
    // savedAt preserved from original
    expect(result[0].savedAt).toBe('2026-01-01T00:00:00.000Z');
    // updatedAt is stamped at upsert time (caller-provided value is ignored
    // so the sync engine has an authoritative local mutation timestamp).
    expect(result[0].updatedAt >= before).toBe(true);
    expect(result[0].dirty).toBe(true);
  });

  it('upsert distinguishes templates by key', async () => {
    await TabGroupTemplateStorage.upsert(makeTemplate({ key: 'work-blue', title: 'Work' }));
    await TabGroupTemplateStorage.upsert(makeTemplate({ key: 'personal-green', title: 'Personal', color: 'green' }));
    const result = await TabGroupTemplateStorage.getAll();
    expect(result).toHaveLength(2);
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it('delete removes template by key', async () => {
    setupStorage({
      tab_group_templates: [
        makeTemplate({ key: 'work-blue' }),
        makeTemplate({ key: 'personal-green', title: 'Personal', color: 'green' }),
      ],
    });
    await TabGroupTemplateStorage.delete('work-blue');
    const result = await TabGroupTemplateStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('personal-green');
  });

  it('delete is a no-op for unknown key', async () => {
    setupStorage({ tab_group_templates: [makeTemplate()] });
    await TabGroupTemplateStorage.delete('no-such-key');
    expect(await TabGroupTemplateStorage.getAll()).toHaveLength(1);
  });
});
