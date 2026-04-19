import { getSessionRepository, getSettingsStorage } from '@core/storage/storage-factory';
import { PromptStorage, getPromptRepository } from '@core/storage/prompt-storage';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { newtabDB } from '@core/storage/newtab-storage';
import { importDashboardFromJSON } from '@core/services/newtab-export.service';
import { updateNewTabSettings } from '@core/services/newtab-settings.service';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import type { Settings } from '@core/types/settings.types';
import type { Session } from '@core/types/session.types';
import type { DashboardExportEnvelope } from '@core/services/newtab-export.service';
import type {
  FullBackupEnvelope,
  FullBackupCounts,
  ImportMode,
  ImportPreview,
  FullImportResult,
  ModuleSelection,
  BackupModule,
} from '@core/types/import-export.types';
import {
  FULL_BACKUP_SOURCE,
  EMPTY_COUNTS,
} from '@core/types/import-export.types';
import { exportFullBackup } from '@core/services/full-export.service';

export const PRE_IMPORT_BACKUP_KEY = 'pre_import_backup';

// ── Type guards ───────────────────────────────────────────────────────────────

function isFullBackupV2(p: unknown): p is FullBackupEnvelope {
  if (typeof p !== 'object' || p === null) return false;
  const r = p as Record<string, unknown>;
  return r['source'] === FULL_BACKUP_SOURCE && r['version'] === '2.0.0';
}

function isDashboardV1(p: unknown): p is DashboardExportEnvelope {
  if (typeof p !== 'object' || p === null) return false;
  const r = p as Record<string, unknown>;
  return r['source'] === 'browser-hub-dashboard' && typeof r['version'] === 'string';
}

function isSessionsV1(p: Record<string, unknown>): boolean {
  return Array.isArray(p['sessions']);
}

// ── Parse + Preview ───────────────────────────────────────────────────────────

/**
 * Parse raw file text and produce an ImportPreview without writing anything.
 * Call this synchronously after reading the file — no storage I/O.
 */
export function previewImport(rawText: string): ImportPreview {
  const zeroCounts = { ...EMPTY_COUNTS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      fileType: 'unknown',
      availableModules: [],
      counts: zeroCounts,
      warnings: [],
      errors: ['File is not valid JSON'],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      fileType: 'unknown',
      availableModules: [],
      counts: zeroCounts,
      warnings: [],
      errors: ['Unrecognised file format'],
    };
  }

  const p = parsed as Record<string, unknown>;

  // ── Full backup v2 ──────────────────────────────────────────────────────────
  if (isFullBackupV2(p)) {
    const env = p;
    const availableModules: BackupModule[] = [];
    if (Array.isArray(env.sessions)) availableModules.push('sessions');
    if (env.settings != null) availableModules.push('settings');
    if (Array.isArray(env.prompts)) availableModules.push('prompts');
    if (Array.isArray(env.subscriptions)) availableModules.push('subscriptions');
    if (Array.isArray(env.tabGroupTemplates)) availableModules.push('tabGroupTemplates');
    if (env.dashboard != null) availableModules.push('dashboard');

    const counts: FullBackupCounts = env.counts ?? { ...EMPTY_COUNTS };
    return {
      fileType: 'full-backup-v2',
      exportedAt: typeof env.exportedAt === 'string' ? env.exportedAt : undefined,
      availableModules,
      counts,
      warnings: [],
      errors: [],
    };
  }

  // ── Dashboard v1 ────────────────────────────────────────────────────────────
  if (isDashboardV1(p)) {
    const env = p as DashboardExportEnvelope;
    return {
      fileType: 'dashboard-v1',
      exportedAt: env.exportedAt,
      availableModules: ['dashboard'],
      counts: {
        ...zeroCounts,
        dashboardBoards: env.counts?.boards ?? 0,
        dashboardCategories: env.counts?.categories ?? 0,
        dashboardEntries: env.counts?.entries ?? 0,
        dashboardQuickLinks: env.counts?.quickLinks ?? 0,
        dashboardTodoLists: env.counts?.todoLists ?? 0,
        dashboardTodoItems: env.counts?.todoItems ?? 0,
      },
      warnings: [],
      errors: [],
    };
  }

  // ── Sessions v1 ─────────────────────────────────────────────────────────────
  if (isSessionsV1(p)) {
    const sessions = p['sessions'] as unknown[];
    return {
      fileType: 'sessions-v1',
      exportedAt: typeof p['exportedAt'] === 'string' ? p['exportedAt'] : undefined,
      availableModules: ['sessions'],
      counts: {
        ...zeroCounts,
        sessions: sessions.length,
      },
      warnings: [],
      errors: [],
    };
  }

  return {
    fileType: 'unknown',
    availableModules: [],
    counts: zeroCounts,
    warnings: [],
    errors: ['Unrecognised file format — expected a Browser Hub export file'],
  };
}

// ── Execute import ────────────────────────────────────────────────────────────

/**
 * Execute the import for the selected modules.
 * In replace mode, all selected modules are validated first, a backup is
 * created, then all writes happen — any validation or backup failure aborts
 * without touching stored data.
 * In merge mode, writes are attempted per module; individual failures are
 * collected and other modules continue.
 */
export async function executeImport(
  rawText: string,
  preview: ImportPreview,
  selection: ModuleSelection,
  mode: ImportMode,
): Promise<FullImportResult> {
  const importedCounts: Partial<FullBackupCounts> = {};
  const skippedModules: BackupModule[] = [];
  const errors: string[] = [];
  const moduleStatus: Partial<Record<BackupModule, 'success' | 'failed' | 'skipped'>> = {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { success: false, importedCounts, skippedModules, errors: ['Failed to parse file'], moduleStatus };
  }

  const p = parsed as Record<string, unknown>;

  // Route to correct handler based on file type
  if (preview.fileType === 'full-backup-v2') {
    const env = parsed as unknown as FullBackupEnvelope;

    // REPLACE mode: validate all selected modules before any write, then backup.
    // Any failure aborts the entire import with no data written.
    if (mode === 'replace') {
      const validationErrors = validateModulesForReplace(env, selection, preview);
      if (validationErrors.length > 0) {
        return { success: false, importedCounts, skippedModules, errors: validationErrors, moduleStatus };
      }

      const selectedForBackup = (Object.keys(selection) as BackupModule[]).filter(
        (m) => selection[m] && preview.availableModules.includes(m),
      );
      try {
        const backupJson = await createAutoBackup(selectedForBackup);
        await chrome.storage.local.set({ [PRE_IMPORT_BACKUP_KEY]: backupJson });
      } catch (e) {
        return {
          success: false,
          importedCounts,
          skippedModules,
          errors: [`Backup failed — import aborted to prevent data loss: ${String(e)}`],
          moduleStatus,
        };
      }
    }

    await runModuleImport('sessions', selection, preview, skippedModules, errors, moduleStatus, async () => {
      if (!env.sessions) return;
      const count = await importSessions(env.sessions, mode);
      importedCounts.sessions = count;
    });

    await runModuleImport('settings', selection, preview, skippedModules, errors, moduleStatus, async () => {
      if (!env.settings) return;
      await importSettings(env.settings);
    });

    await runModuleImport('prompts', selection, preview, skippedModules, errors, moduleStatus, async () => {
      if (!env.prompts) return;
      const count = await importPrompts(
        env.prompts,
        env.promptFolders ?? [],
        env.promptCategories ?? [],
        env.promptTags ?? [],
        mode,
      );
      importedCounts.prompts = count;
    });

    await runModuleImport('subscriptions', selection, preview, skippedModules, errors, moduleStatus, async () => {
      if (!env.subscriptions) return;
      const count = await importSubscriptions(
        env.subscriptions,
        env.subscriptionCategories ?? [],
        mode,
      );
      importedCounts.subscriptions = count;
    });

    await runModuleImport('tabGroupTemplates', selection, preview, skippedModules, errors, moduleStatus, async () => {
      if (!env.tabGroupTemplates) return;
      const count = await importTabGroupTemplates(env.tabGroupTemplates, mode);
      importedCounts.tabGroupTemplates = count;
    });

    await runModuleImport('dashboard', selection, preview, skippedModules, errors, moduleStatus, async () => {
      if (!env.dashboard) return;
      const counts = await importDashboard(env.dashboard, mode);
      importedCounts.dashboardBoards = counts.boards;
      importedCounts.dashboardCategories = counts.categories;
      importedCounts.dashboardEntries = counts.entries;
      importedCounts.dashboardQuickLinks = counts.quickLinks;
      importedCounts.dashboardTodoLists = counts.todoLists;
      importedCounts.dashboardTodoItems = counts.todoItems;
    });

  } else if (preview.fileType === 'dashboard-v1') {
    if (selection.dashboard) {
      try {
        const result = await importDashboardFromJSON(rawText);
        if (result.success && result.counts) {
          importedCounts.dashboardBoards = result.counts.boards;
          importedCounts.dashboardCategories = result.counts.categories;
          importedCounts.dashboardEntries = result.counts.entries;
          importedCounts.dashboardQuickLinks = result.counts.quickLinks;
          importedCounts.dashboardTodoLists = result.counts.todoLists;
          importedCounts.dashboardTodoItems = result.counts.todoItems;
          moduleStatus.dashboard = 'success';
        } else {
          errors.push(result.error ?? 'Dashboard import failed');
          moduleStatus.dashboard = 'failed';
        }
      } catch (e) {
        errors.push(`Dashboard import error: ${String(e)}`);
        moduleStatus.dashboard = 'failed';
      }
    } else {
      skippedModules.push('dashboard');
      moduleStatus.dashboard = 'skipped';
    }

  } else if (preview.fileType === 'sessions-v1') {
    if (selection.sessions) {
      try {
        const sessions = (p['sessions'] as Session[]) ?? [];
        const count = await importSessions(sessions, mode);
        importedCounts.sessions = count;
        moduleStatus.sessions = 'success';
      } catch (e) {
        errors.push(`Sessions import error: ${String(e)}`);
        moduleStatus.sessions = 'failed';
      }
    } else {
      skippedModules.push('sessions');
      moduleStatus.sessions = 'skipped';
    }
  }

  return {
    success: errors.length === 0,
    importedCounts,
    skippedModules,
    errors,
    moduleStatus,
  };
}

/** Create a JSON backup string for the specified modules (for auto-backup before replace). */
export async function createAutoBackup(modules: BackupModule[]): Promise<string> {
  const selection: ModuleSelection = {
    sessions: modules.includes('sessions'),
    settings: modules.includes('settings'),
    prompts: modules.includes('prompts'),
    subscriptions: modules.includes('subscriptions'),
    tabGroupTemplates: modules.includes('tabGroupTemplates'),
    dashboard: modules.includes('dashboard'),
  };
  return exportFullBackup(selection);
}

// ── Module import helpers ─────────────────────────────────────────────────────

function validateModulesForReplace(
  env: FullBackupEnvelope,
  selection: ModuleSelection,
  preview: ImportPreview,
): string[] {
  const errs: string[] = [];
  const check = (module: BackupModule, value: unknown, label: string) => {
    if (selection[module] && preview.availableModules.includes(module)) {
      if (!Array.isArray(value)) errs.push(`${label} data is invalid — expected an array`);
    }
  };
  check('sessions', env.sessions, 'Sessions');
  check('prompts', env.prompts, 'Prompts');
  check('subscriptions', env.subscriptions, 'Subscriptions');
  check('tabGroupTemplates', env.tabGroupTemplates, 'Tab group templates');
  return errs;
}

async function runModuleImport(
  module: BackupModule,
  selection: ModuleSelection,
  preview: ImportPreview,
  skippedModules: BackupModule[],
  errors: string[],
  moduleStatus: Partial<Record<BackupModule, 'success' | 'failed' | 'skipped'>>,
  fn: () => Promise<void>,
): Promise<void> {
  if (!selection[module] || !preview.availableModules.includes(module)) {
    skippedModules.push(module);
    moduleStatus[module] = 'skipped';
    return;
  }
  try {
    await fn();
    moduleStatus[module] = 'success';
  } catch (e) {
    errors.push(`${module} import error: ${String(e)}`);
    moduleStatus[module] = 'failed';
  }
}

async function importSessions(sessions: Session[], mode: ImportMode): Promise<number> {
  const repo = getSessionRepository();
  if (mode === 'replace') {
    await repo.replaceAll(sessions);
  } else {
    await repo.importMany(sessions);
  }
  return sessions.length;
}

async function importSettings(settings: Settings): Promise<void> {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...settings };
  await getSettingsStorage().set(STORAGE_KEYS.SETTINGS, merged);
}

async function importPrompts(
  prompts: import('@core/types/prompt.types').Prompt[],
  folders: import('@core/types/prompt.types').PromptFolder[],
  categories: import('@core/types/prompt.types').PromptCategory[],
  tags: import('@core/types/prompt.types').PromptTag[],
  mode: ImportMode,
): Promise<number> {
  // Use the repository directly to avoid calling guardAction per item.
  // Import is a data-restoration operation — consistent with importSessions,
  // importSubscriptions, and importTabGroupTemplates which all bypass per-item guards.
  const promptsRepo = getPromptRepository();
  if (mode === 'replace') {
    await PromptStorage.deleteAll();
    await PromptStorage.setFolders(folders);
    await PromptStorage.setCategories(categories);
    await PromptStorage.setTags(tags);
    await promptsRepo.importMany(prompts);
  } else {
    await PromptStorage.mergeFolders(folders);
    await PromptStorage.mergeCategories(categories);
    await PromptStorage.mergeTags(tags);
    await promptsRepo.importMany(prompts);
  }
  return prompts.length;
}

async function importSubscriptions(
  subs: import('@core/types/subscription.types').Subscription[],
  categories: import('@core/types/subscription.types').CustomCategory[],
  mode: ImportMode,
): Promise<number> {
  if (mode === 'replace') {
    await SubscriptionStorage.deleteAll();
    await SubscriptionStorage.replaceCustomCategories(categories);
    await SubscriptionStorage.importMany(subs);
  } else {
    await SubscriptionStorage.importMany(subs);
    await SubscriptionStorage.mergeCustomCategories(categories);
  }
  return subs.length;
}

async function importTabGroupTemplates(
  templates: import('@core/types/tab-group.types').TabGroupTemplate[],
  mode: ImportMode,
): Promise<number> {
  if (mode === 'replace') {
    await TabGroupTemplateStorage.replaceAll(templates);
  } else {
    for (const t of templates) await TabGroupTemplateStorage.upsert(t);
  }
  return templates.length;
}

async function importDashboard(
  envelope: DashboardExportEnvelope,
  mode: ImportMode,
): Promise<DashboardExportEnvelope['counts']> {
  if (mode === 'replace') {
    // Delegate to existing service which handles clear + rewrite + settings normalisation
    const result = await importDashboardFromJSON(JSON.stringify(envelope));
    if (!result.success) throw new Error(result.error ?? 'Dashboard import failed');
    return result.counts ?? { boards: 0, categories: 0, entries: 0, quickLinks: 0, todoLists: 0, todoItems: 0 };
  } else {
    // Merge: upsert without clearing
    const stores = [
      { store: 'boards' as const, items: envelope.boards },
      { store: 'bookmarkCategories' as const, items: envelope.categories },
      { store: 'bookmarkEntries' as const, items: envelope.entries },
      { store: 'quickLinks' as const, items: envelope.quickLinks },
      { store: 'todoLists' as const, items: envelope.todoLists },
      { store: 'todoItems' as const, items: envelope.todoItems },
    ] as const;

    await Promise.all(
      stores.flatMap(({ store, items }) =>
        (items as Array<{ id: string }>).map((item) => newtabDB.put(store, item)),
      ),
    );

    // Merge settings (keep existing, fill in missing fields)
    if (envelope.settings) {
      const { getNewTabSettings } = await import('@core/services/newtab-settings.service');
      const current = await getNewTabSettings();
      await updateNewTabSettings({ ...envelope.settings, ...current });
    }

    return {
      boards: envelope.boards.length,
      categories: envelope.categories.length,
      entries: envelope.entries.length,
      quickLinks: envelope.quickLinks.length,
      todoLists: envelope.todoLists.length,
      todoItems: envelope.todoItems.length,
    };
  }
}
