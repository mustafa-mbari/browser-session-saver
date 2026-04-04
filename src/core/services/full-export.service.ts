import { getSessionRepository, getSettingsStorage } from '@core/storage/storage-factory';
import { PromptStorage } from '@core/storage/prompt-storage';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { newtabDB } from '@core/storage/newtab-storage';
import { getNewTabSettings } from '@core/services/newtab-settings.service';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import type { Settings } from '@core/types/settings.types';
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptFolder, PromptCategory, PromptTag } from '@core/types/prompt.types';
import type { Subscription, CustomCategory } from '@core/types/subscription.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoList, TodoItem } from '@core/types/newtab.types';
import type { DashboardExportEnvelope } from '@core/services/newtab-export.service';
import type {
  FullBackupEnvelope,
  FullBackupCounts,
  ModuleSelection,
  SupplementaryFormat,
  FULL_BACKUP_SOURCE,
} from '@core/types/import-export.types';
import { FULL_BACKUP_VERSION } from '@core/types/import-export.types';

// ── Data readers ──────────────────────────────────────────────────────────────

async function readSessions(): Promise<Session[]> {
  return getSessionRepository().getAll();
}

async function readSettings(): Promise<Settings> {
  return (await getSettingsStorage().get<Settings>(STORAGE_KEYS.SETTINGS)) ?? { ...DEFAULT_SETTINGS };
}

async function readPrompts(): Promise<{
  prompts: Prompt[];
  folders: PromptFolder[];
  categories: PromptCategory[];
  tags: PromptTag[];
}> {
  const [prompts, folders, categories, tags] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
    PromptStorage.getCategories(),
    PromptStorage.getTags(),
  ]);
  return { prompts, folders, categories, tags };
}

async function readSubscriptions(): Promise<{
  subscriptions: Subscription[];
  categories: CustomCategory[];
}> {
  const [subscriptions, categories] = await Promise.all([
    SubscriptionStorage.getAll(),
    SubscriptionStorage.getCustomCategories(),
  ]);
  return { subscriptions, categories };
}

async function readTabGroups(): Promise<TabGroupTemplate[]> {
  return TabGroupTemplateStorage.getAll();
}

async function readDashboard(): Promise<DashboardExportEnvelope> {
  const [boards, categories, entries, quickLinks, todoLists, todoItems, settings] =
    await Promise.all([
      newtabDB.getAll<Board>('boards'),
      newtabDB.getAll<BookmarkCategory>('bookmarkCategories'),
      newtabDB.getAll<BookmarkEntry>('bookmarkEntries'),
      newtabDB.getAll<QuickLink>('quickLinks'),
      newtabDB.getAll<TodoList>('todoLists'),
      newtabDB.getAll<TodoItem>('todoItems'),
      getNewTabSettings(),
    ]);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    source: 'browser-hub-dashboard',
    counts: {
      boards: boards.length,
      categories: categories.length,
      entries: entries.length,
      quickLinks: quickLinks.length,
      todoLists: todoLists.length,
      todoItems: todoItems.length,
    },
    boards,
    categories,
    entries,
    quickLinks,
    todoLists,
    todoItems,
    settings,
  };
}

// ── Count builder ─────────────────────────────────────────────────────────────

function buildCounts(env: Omit<FullBackupEnvelope, 'version' | 'exportedAt' | 'source' | 'counts'>): FullBackupCounts {
  const d = env.dashboard;
  return {
    sessions: env.sessions?.length ?? 0,
    prompts: env.prompts?.length ?? 0,
    promptFolders: env.promptFolders?.length ?? 0,
    promptCategories: env.promptCategories?.length ?? 0,
    promptTags: env.promptTags?.length ?? 0,
    subscriptions: env.subscriptions?.length ?? 0,
    subscriptionCategories: env.subscriptionCategories?.length ?? 0,
    tabGroupTemplates: env.tabGroupTemplates?.length ?? 0,
    dashboardBoards: d?.counts.boards ?? 0,
    dashboardCategories: d?.counts.categories ?? 0,
    dashboardEntries: d?.counts.entries ?? 0,
    dashboardQuickLinks: d?.counts.quickLinks ?? 0,
    dashboardTodoLists: d?.counts.todoLists ?? 0,
    dashboardTodoItems: d?.counts.todoItems ?? 0,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a versioned full-backup JSON string for the selected modules.
 * Only the selected modules are included in the output.
 */
export async function exportFullBackup(selection: ModuleSelection): Promise<string> {
  // Fan out all reads in parallel, conditionally
  const [
    sessions,
    settings,
    promptData,
    subsData,
    tabGroups,
    dashboard,
  ] = await Promise.all([
    selection.sessions ? readSessions() : Promise.resolve(null),
    selection.settings ? readSettings() : Promise.resolve(null),
    selection.prompts ? readPrompts() : Promise.resolve(null),
    selection.subscriptions ? readSubscriptions() : Promise.resolve(null),
    selection.tabGroupTemplates ? readTabGroups() : Promise.resolve(null),
    selection.dashboard ? readDashboard() : Promise.resolve(null),
  ]);

  const partial: Omit<FullBackupEnvelope, 'version' | 'exportedAt' | 'source' | 'counts'> = {};
  if (sessions !== null) partial.sessions = sessions;
  if (settings !== null) partial.settings = settings;
  if (promptData !== null) {
    partial.prompts = promptData.prompts;
    partial.promptFolders = promptData.folders;
    partial.promptCategories = promptData.categories;
    partial.promptTags = promptData.tags;
  }
  if (subsData !== null) {
    partial.subscriptions = subsData.subscriptions;
    partial.subscriptionCategories = subsData.categories;
  }
  if (tabGroups !== null) partial.tabGroupTemplates = tabGroups;
  if (dashboard !== null) partial.dashboard = dashboard;

  const envelope: FullBackupEnvelope = {
    version: FULL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    source: 'browser-hub-full-backup' as typeof FULL_BACKUP_SOURCE,
    counts: buildCounts(partial),
    ...partial,
  };

  return JSON.stringify(envelope, null, 2);
}

/** Convenience wrapper: export all modules. */
export async function exportAllAsJSON(): Promise<string> {
  return exportFullBackup({
    sessions: true,
    settings: true,
    prompts: true,
    subscriptions: true,
    tabGroupTemplates: true,
    dashboard: true,
  });
}

// ── Supplementary formats ─────────────────────────────────────────────────────

/** Export a single data type in a human-friendly format (CSV or Markdown). */
export async function exportSupplementary(format: SupplementaryFormat): Promise<string> {
  switch (format) {
    case 'subscriptions-csv': {
      const subs = await SubscriptionStorage.getAll();
      return subscriptionsToCSV(subs);
    }
    case 'prompts-markdown': {
      const [prompts, folders, categories] = await Promise.all([
        PromptStorage.getAll(),
        PromptStorage.getFolders(),
        PromptStorage.getCategories(),
      ]);
      return promptsToMarkdown(prompts, folders, categories);
    }
    case 'todos-csv': {
      const [lists, items] = await Promise.all([
        newtabDB.getAll<TodoList>('todoLists'),
        newtabDB.getAll<TodoItem>('todoItems'),
      ]);
      return todosToCSV(lists, items);
    }
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function csvEscape(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function subscriptionsToCSV(subs: Subscription[]): string {
  const rows: string[] = [
    'Name,URL,Category,Price,Currency,BillingCycle,NextBillingDate,Status,PaymentMethod,Notes',
  ];
  for (const s of subs) {
    rows.push(
      [
        csvEscape(s.name),
        csvEscape(s.url ?? ''),
        csvEscape(s.category),
        csvEscape(s.price),
        csvEscape(s.currency),
        csvEscape(s.billingCycle),
        csvEscape(s.nextBillingDate),
        csvEscape(s.status),
        csvEscape(s.paymentMethod ?? ''),
        csvEscape(s.notes ?? ''),
      ].join(','),
    );
  }
  return rows.join('\n');
}

function promptsToMarkdown(
  prompts: Prompt[],
  folders: PromptFolder[],
  categories: PromptCategory[],
): string {
  const lines: string[] = ['# Prompts Export', ''];

  // Build folder map for lookup
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Group prompts by folder
  const byFolder = new Map<string | undefined, Prompt[]>();
  for (const p of prompts) {
    const key = p.folderId;
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key)!.push(p);
  }

  // Emit root (no folder) prompts first
  const rootPrompts = byFolder.get(undefined) ?? [];
  if (rootPrompts.length > 0) {
    lines.push('## Uncategorized');
    lines.push('');
    for (const p of rootPrompts) {
      emitPromptMarkdown(p, lines, categoryMap);
    }
  }

  // Then folder-grouped prompts
  for (const folder of folders) {
    const folderPrompts = byFolder.get(folder.id) ?? [];
    if (folderPrompts.length === 0) continue;

    // Build breadcrumb for nested folders
    const breadcrumb = buildFolderBreadcrumb(folder.id, folderMap);
    lines.push(`## ${breadcrumb}`);
    lines.push('');

    for (const p of folderPrompts) {
      emitPromptMarkdown(p, lines, categoryMap);
    }
  }

  return lines.join('\n');
}

function buildFolderBreadcrumb(
  folderId: string,
  folderMap: Map<string, PromptFolder>,
): string {
  const parts: string[] = [];
  let current: PromptFolder | undefined = folderMap.get(folderId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? folderMap.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}

function emitPromptMarkdown(
  p: Prompt,
  lines: string[],
  categoryMap: Map<string, PromptCategory>,
): void {
  lines.push(`### ${p.title}`);
  const meta: string[] = [];
  if (p.tags.length > 0) meta.push(`Tags: ${p.tags.join(', ')}`);
  if (p.categoryId) {
    const cat = categoryMap.get(p.categoryId);
    if (cat) meta.push(`Category: ${cat.name}`);
  }
  if (p.source === 'app') meta.push('Source: App');
  if (meta.length > 0) lines.push(`*${meta.join(' · ')}*`);
  if (p.description) lines.push('');
  if (p.description) lines.push(p.description);
  lines.push('');
  lines.push('```');
  lines.push(p.content);
  lines.push('```');
  lines.push('');
}

function todosToCSV(lists: TodoList[], items: TodoItem[]): string {
  const listMap = new Map(lists.map((l) => [l.id, l.name]));
  const rows: string[] = ['List,Item,Completed,Priority,DueDate,CreatedAt'];
  for (const item of items) {
    rows.push(
      [
        csvEscape(listMap.get(item.listId) ?? ''),
        csvEscape(item.text),
        item.completed ? 'Yes' : 'No',
        csvEscape(item.priority),
        csvEscape(item.dueDate ?? ''),
        csvEscape(item.createdAt),
      ].join(','),
    );
  }
  return rows.join('\n');
}
