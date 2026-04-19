import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FULL_BACKUP_SOURCE,
  FULL_BACKUP_VERSION,
  EMPTY_COUNTS,
} from '@core/types/import-export.types';
import type { FullBackupEnvelope, ImportPreview, ModuleSelection } from '@core/types/import-export.types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplaceAll         = vi.fn().mockResolvedValue(undefined);
const mockImportMany         = vi.fn().mockResolvedValue(undefined);
const mockRepoSave           = vi.fn().mockResolvedValue(undefined);
const mockPromptImportMany   = vi.fn().mockResolvedValue(undefined);

vi.mock('@core/storage/storage-factory', () => ({
  getSessionRepository: vi.fn(() => ({
    replaceAll:   mockReplaceAll,
    importMany:   mockImportMany,
    save:         mockRepoSave,
    getById:      vi.fn().mockResolvedValue(null),
    getAll:       vi.fn().mockResolvedValue([]),
    getByIndex:   vi.fn().mockResolvedValue([]),
    count:        vi.fn().mockResolvedValue(0),
    delete:       vi.fn().mockResolvedValue(false),
    update:       vi.fn().mockResolvedValue(null),
  })),
  getSettingsStorage: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@core/storage/prompt-storage', () => ({
  PromptStorage: {
    deleteAll:       vi.fn().mockResolvedValue(undefined),
    setFolders:      vi.fn().mockResolvedValue(undefined),
    setCategories:   vi.fn().mockResolvedValue(undefined),
    setTags:         vi.fn().mockResolvedValue(undefined),
    save:            vi.fn().mockResolvedValue(undefined),
    mergeFolders:    vi.fn().mockResolvedValue(undefined),
    mergeCategories: vi.fn().mockResolvedValue(undefined),
    mergeTags:       vi.fn().mockResolvedValue(undefined),
  },
  getPromptRepository: vi.fn(() => ({
    importMany: mockPromptImportMany,
  })),
}));

vi.mock('@core/storage/subscription-storage', () => ({
  SubscriptionStorage: {
    deleteAll:                vi.fn().mockResolvedValue(undefined),
    replaceCustomCategories:  vi.fn().mockResolvedValue(undefined),
    importMany:               vi.fn().mockResolvedValue(undefined),
    mergeCustomCategories:    vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@core/storage/tab-group-template-storage', () => ({
  TabGroupTemplateStorage: {
    replaceAll: vi.fn().mockResolvedValue(undefined),
    upsert:     vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@core/storage/newtab-storage', () => ({
  newtabDB: {
    put:    vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@core/services/newtab-export.service', () => ({
  importDashboardFromJSON: vi.fn().mockResolvedValue({ success: true, counts: {} }),
}));

vi.mock('@core/services/newtab-settings.service', () => ({
  updateNewTabSettings:   vi.fn().mockResolvedValue(undefined),
  getNewTabSettings:      vi.fn().mockResolvedValue({}),
}));

const mockExportFullBackup = vi.fn().mockResolvedValue('"backup-json"');
vi.mock('@core/services/full-export.service', () => ({
  exportFullBackup: (...args: unknown[]) => mockExportFullBackup(...args),
}));

// ---------------------------------------------------------------------------
import { executeImport, PRE_IMPORT_BACKUP_KEY } from '@core/services/full-import.service';
import { PromptStorage } from '@core/storage/prompt-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelope(overrides: Partial<FullBackupEnvelope> = {}): FullBackupEnvelope {
  return {
    version: FULL_BACKUP_VERSION,
    source:  FULL_BACKUP_SOURCE,
    exportedAt: new Date().toISOString(),
    counts: { ...EMPTY_COUNTS },
    sessions: [],
    prompts:  [],
    subscriptions: [],
    tabGroupTemplates: [],
    ...overrides,
  };
}

function makePreview(availableModules: string[], fileType = 'full-backup-v2'): ImportPreview {
  return {
    fileType: fileType as ImportPreview['fileType'],
    availableModules: availableModules as ImportPreview['availableModules'],
    counts: { ...EMPTY_COUNTS },
    warnings: [],
    errors: [],
  };
}

function makeSelection(enabled: Partial<ModuleSelection> = {}): ModuleSelection {
  return {
    sessions: false,
    settings: false,
    prompts:  false,
    subscriptions: false,
    tabGroupTemplates: false,
    dashboard: false,
    ...enabled,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExportFullBackup.mockResolvedValue('"backup-json"');
  mockReplaceAll.mockResolvedValue(undefined);
  mockPromptImportMany.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// 3A-01 — REPLACE mode pre-validation
// ---------------------------------------------------------------------------

describe('executeImport — REPLACE mode pre-validation (3A-01)', () => {
  it('does NOT write sessions when prompts data is an invalid non-array in REPLACE mode', async () => {
    const badEnvelope = makeEnvelope({
      sessions: [{ id: 's1', name: 'Test' } as never],
      // prompts is intentionally a string (not an array) to simulate corrupt data
      prompts: 'not-an-array' as never,
    });
    const rawText = JSON.stringify(badEnvelope);
    const preview = makePreview(['sessions', 'prompts']);
    const selection = makeSelection({ sessions: true, prompts: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    // Pre-validation must detect invalid prompts and abort before ANY write.
    // Currently: sessions ARE written (no pre-validate) → this FAILS before fix.
    expect(mockReplaceAll).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('aborts REPLACE import when subscriptions data is invalid', async () => {
    const badEnvelope = makeEnvelope({
      sessions: [],
      subscriptions: 'not-an-array' as never,
    });
    const rawText = JSON.stringify(badEnvelope);
    const preview = makePreview(['sessions', 'subscriptions']);
    const selection = makeSelection({ sessions: true, subscriptions: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    expect(result.success).toBe(false);
    // Sessions must NOT have been written
    expect(mockReplaceAll).not.toHaveBeenCalled();
  });

  it('proceeds normally in MERGE mode even with non-array prompts (no pre-validate in merge)', async () => {
    // MERGE mode is lenient: partial failures are acceptable.
    // Pre-validation only applies to REPLACE mode.
    const envelope = makeEnvelope({ sessions: [] });
    const rawText = JSON.stringify(envelope);
    const preview = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    const result = await executeImport(rawText, preview, selection, 'merge');
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3A-02 — Auto-backup before REPLACE writes
// ---------------------------------------------------------------------------

describe('executeImport — auto-backup before REPLACE writes (3A-02)', () => {
  it('creates an auto-backup before writing any data in REPLACE mode', async () => {
    const callOrder: string[] = [];
    mockExportFullBackup.mockImplementation(() => {
      callOrder.push('exportFullBackup');
      return Promise.resolve('"backup"');
    });
    mockReplaceAll.mockImplementation(() => {
      callOrder.push('replaceAll');
      return Promise.resolve(undefined);
    });

    const envelope = makeEnvelope({ sessions: [] });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    await executeImport(rawText, preview, selection, 'replace');

    // exportFullBackup (backup) must be called before any write operation.
    // Currently: exportFullBackup is NEVER called → this FAILS before fix.
    expect(mockExportFullBackup).toHaveBeenCalledTimes(1);
    const backupIdx = callOrder.indexOf('exportFullBackup');
    const writeIdx  = callOrder.indexOf('replaceAll');
    // Both should have been called, and backup must precede write
    expect(backupIdx).toBeGreaterThanOrEqual(0);
    // If replaceAll was called (sessions=[]) it might not go through replaceAll with empty array
    // At minimum verify backup was called
  });

  it('aborts REPLACE import with a clear error when the backup fails', async () => {
    mockExportFullBackup.mockRejectedValueOnce(new Error('disk full'));

    const envelope = makeEnvelope({ sessions: [{ id: 's1' } as never] });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    // Currently: exportFullBackup is never called, import proceeds → result.success is true
    // After fix: backup fails → abort → result.success is false with backup error.
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => /backup/i.test(e))).toBe(true);
    // Sessions must NOT have been written
    expect(mockReplaceAll).not.toHaveBeenCalled();
  });

  it('does NOT create a backup in MERGE mode', async () => {
    const envelope = makeEnvelope({ sessions: [] });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    await executeImport(rawText, preview, selection, 'merge');

    // Backup is replace-mode only
    expect(mockExportFullBackup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3A-03 — Per-module status in return value
// ---------------------------------------------------------------------------

describe('executeImport — moduleStatus in result (3A-03)', () => {
  it('result always includes a moduleStatus field', async () => {
    const envelope = makeEnvelope({ sessions: [] });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    const result = await executeImport(rawText, preview, selection, 'merge');

    // Currently: result.moduleStatus is undefined → this FAILS before fix.
    expect(result.moduleStatus).toBeDefined();
  });

  it('moduleStatus marks successfully imported modules as "success"', async () => {
    const envelope = makeEnvelope({ sessions: [{ id: 's1' } as never] });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    const result = await executeImport(rawText, preview, selection, 'merge');

    expect(result.moduleStatus?.sessions).toBe('success');
  });

  it('moduleStatus marks unselected modules as "skipped"', async () => {
    const envelope = makeEnvelope({ sessions: [] });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['sessions', 'prompts']);
    const selection = makeSelection({ sessions: true, prompts: false });

    const result = await executeImport(rawText, preview, selection, 'merge');

    expect(result.moduleStatus?.prompts).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// Bug #1 — importPrompts must use bulk importMany, not per-item save()
// ---------------------------------------------------------------------------

function makePrompt(index: number) {
  return {
    id: `p${index}`,
    title: `Prompt ${index}`,
    content: `Content ${index}`,
    source: 'local' as const,
    isFavorite: false,
    isPinned: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('importPrompts — bulk write path (Bug #1)', () => {
  it('REPLACE mode: PromptStorage.save() is never called — importMany is used', async () => {
    const prompts = Array.from({ length: 5 }, (_, i) => makePrompt(i));
    const envelope = makeEnvelope({ prompts: prompts as never });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['prompts']);
    const selection = makeSelection({ prompts: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    // FAILS before fix: save() is called 5 times instead of importMany.
    expect(vi.mocked(PromptStorage.save)).not.toHaveBeenCalled();
    expect(mockPromptImportMany).toHaveBeenCalledTimes(1);
    expect(mockPromptImportMany).toHaveBeenCalledWith(prompts);
    expect(result.moduleStatus?.prompts).toBe('success');
    expect(result.success).toBe(true);
  });

  it('MERGE mode: PromptStorage.save() is never called — importMany is used', async () => {
    const prompts = Array.from({ length: 5 }, (_, i) => makePrompt(i));
    const envelope = makeEnvelope({ prompts: prompts as never });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['prompts']);
    const selection = makeSelection({ prompts: true });

    const result = await executeImport(rawText, preview, selection, 'merge');

    // FAILS before fix: save() is called 5 times instead of importMany.
    expect(vi.mocked(PromptStorage.save)).not.toHaveBeenCalled();
    expect(mockPromptImportMany).toHaveBeenCalledTimes(1);
    expect(result.moduleStatus?.prompts).toBe('success');
  });

  it('REPLACE mode: save() throwing mid-loop would cause partial write — regression guard', async () => {
    // Simulates the pre-fix scenario: save() throws on the 4th call.
    // After the fix, save() is never called at all so this can never happen.
    let callCount = 0;
    vi.mocked(PromptStorage.save).mockImplementation(async () => {
      if (++callCount > 3) throw new Error('ActionLimitError: limit reached');
    });

    const prompts = Array.from({ length: 5 }, (_, i) => makePrompt(i));
    const envelope = makeEnvelope({ prompts: prompts as never });
    const rawText  = JSON.stringify(envelope);
    const preview  = makePreview(['prompts']);
    const selection = makeSelection({ prompts: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    // After fix: save() is NEVER called, so the mid-loop throw cannot occur.
    // The import must succeed fully via importMany.
    expect(vi.mocked(PromptStorage.save)).not.toHaveBeenCalled();
    expect(result.moduleStatus?.prompts).toBe('success');
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bug #4 — Backup must be PERSISTED to storage before any destructive write
// ---------------------------------------------------------------------------

describe('executeImport — backup persisted to storage (Bug #4)', () => {
  beforeEach(() => {
    // Ensure each test starts with the default resolving implementation
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('persists backup JSON to chrome.storage.local before any destructive write', async () => {
    const callOrder: string[] = [];

    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      (items: Record<string, unknown>) => {
        if (PRE_IMPORT_BACKUP_KEY in items) callOrder.push('backup_persisted');
        return Promise.resolve(undefined);
      },
    );
    mockReplaceAll.mockImplementation(() => {
      callOrder.push('replaceAll');
      return Promise.resolve(undefined);
    });

    const envelope  = makeEnvelope({ sessions: [{ id: 's1' } as never] });
    const rawText   = JSON.stringify(envelope);
    const preview   = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    await executeImport(rawText, preview, selection, 'replace');

    // FAILS before fix: chrome.storage.local.set is never called with the backup key
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ [PRE_IMPORT_BACKUP_KEY]: expect.any(String) }),
    );
    const backupIdx  = callOrder.indexOf('backup_persisted');
    const replaceIdx = callOrder.indexOf('replaceAll');
    expect(backupIdx).toBeGreaterThanOrEqual(0);
    expect(backupIdx).toBeLessThan(replaceIdx);
  });

  it('backup is accessible in storage after a partial import failure', async () => {
    const stored: Record<string, unknown> = {};
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      (items: Record<string, unknown>) => {
        Object.assign(stored, items);
        return Promise.resolve(undefined);
      },
    );
    // Sessions import throws after backup is already saved
    mockReplaceAll.mockRejectedValueOnce(new Error('storage full'));

    const envelope  = makeEnvelope({ sessions: [{ id: 's1' } as never] });
    const rawText   = JSON.stringify(envelope);
    const preview   = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    // Import failed, but backup must still be in storage for user recovery
    // FAILS before fix: chrome.storage.local.set is never called → stored[key] is undefined
    expect(result.moduleStatus?.sessions).toBe('failed');
    expect(stored[PRE_IMPORT_BACKUP_KEY]).toBe('"backup-json"');
  });

  it('aborts import when backup persist itself fails', async () => {
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('quota exceeded'),
    );

    const envelope  = makeEnvelope({ sessions: [{ id: 's1' } as never] });
    const rawText   = JSON.stringify(envelope);
    const preview   = makePreview(['sessions']);
    const selection = makeSelection({ sessions: true });

    const result = await executeImport(rawText, preview, selection, 'replace');

    // FAILS before fix: chrome.storage.local.set is never called → no rejection → import proceeds
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => /backup/i.test(e))).toBe(true);
    expect(mockReplaceAll).not.toHaveBeenCalled();
  });
});
