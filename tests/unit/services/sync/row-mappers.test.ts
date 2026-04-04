import { describe, it, expect } from 'vitest';
import { sessionMapper } from '@core/services/sync/row-mappers/session.mapper';
import { promptMapper, promptFolderMapper } from '@core/services/sync/row-mappers/prompt.mapper';
import { subscriptionMapper } from '@core/services/sync/row-mappers/subscription.mapper';
import { tabGroupTemplateRawMapper } from '@core/services/sync/row-mappers/tab-group.mapper';
import { todoListMapper, todoItemMapper } from '@core/services/sync/row-mappers/todo.mapper';
import {
  bookmarkCategoryMapper,
  bookmarkCategoryFromRowWithContext,
  bookmarkEntryMapper,
  bookmarkEntryFromRowWithContext,
} from '@core/services/sync/row-mappers/bookmark.mapper';
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { Subscription } from '@core/types/subscription.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { BookmarkCategory, BookmarkEntry, TodoList, TodoItem } from '@core/types/newtab.types';

const userId = 'user-123';

// ─── Session ────────────────────────────────────────────────────────────────

describe('sessionMapper', () => {
  const session: Session = {
    id: 'sess-1',
    name: 'Work',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    tabs: [{ id: 't1', url: 'https://a.com', title: 'A', favIconUrl: '', index: 0, pinned: false, groupId: -1, active: true, scrollPosition: { x: 0, y: 0 } }],
    tabGroups: [{ id: 1, title: 'Dev', color: 'blue', collapsed: false, tabIds: ['t1'] }],
    windowId: 1,
    tags: ['work'],
    isPinned: true,
    isStarred: false,
    isLocked: false,
    isAutoSave: false,
    autoSaveTrigger: 'manual',
    notes: 'some notes',
    tabCount: 1,
    version: '2',
  };

  it('round-trips session through toRow and fromRow', () => {
    const row = sessionMapper.toRow(session, userId);
    expect(row.user_id).toBe(userId);
    expect(row.is_pinned).toBe(true);
    expect(row.created_at).toBe('2024-01-01T00:00:00Z');

    const restored = sessionMapper.fromRow(row);
    expect(restored.id).toBe(session.id);
    expect(restored.name).toBe(session.name);
    expect(restored.isPinned).toBe(true);
    expect(restored.tabs).toEqual(session.tabs);
    expect(restored.tabGroups).toEqual(session.tabGroups);
  });
});

// ─── Prompt ─────────────────────────────────────────────────────────────────

describe('promptMapper', () => {
  const prompt: Prompt = {
    id: 'p-1',
    title: 'Test Prompt',
    content: 'Hello {{name}}',
    description: 'A test',
    categoryId: 'cat-1',
    folderId: 'f-1',
    source: 'local',
    tags: ['test'],
    isFavorite: true,
    isPinned: false,
    usageCount: 5,
    lastUsedAt: '2024-06-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  };

  it('round-trips prompt', () => {
    const row = promptMapper.toRow(prompt, userId);
    expect(row.is_favorite).toBe(true);
    expect(row.folder_id).toBe('f-1');

    const restored = promptMapper.fromRow(row);
    expect(restored.id).toBe('p-1');
    expect(restored.isFavorite).toBe(true);
    expect(restored.folderId).toBe('f-1');
    expect(restored.usageCount).toBe(5);
  });
});

describe('promptFolderMapper', () => {
  const folder: PromptFolder = {
    id: 'f-1',
    name: 'My Folder',
    icon: '📁',
    color: '#ff0000',
    source: 'app',
    parentId: 'f-0',
    position: 2,
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('round-trips folder', () => {
    const row = promptFolderMapper.toRow(folder, userId);
    expect(row.parent_id).toBe('f-0');
    expect(row.source).toBe('app');

    const restored = promptFolderMapper.fromRow(row);
    expect(restored.parentId).toBe('f-0');
    expect(restored.source).toBe('app');
    expect(restored.position).toBe(2);
  });
});

// ─── Subscription ───────────────────────────────────────────────────────────

describe('subscriptionMapper', () => {
  const sub: Subscription = {
    id: 'sub-1',
    name: 'Netflix',
    logo: 'https://logo.com/n.png',
    url: 'https://netflix.com',
    category: 'streaming',
    price: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: '2024-02-01',
    status: 'active',
    reminder: 3,
    tags: ['entertainment'],
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('round-trips subscription', () => {
    const row = subscriptionMapper.toRow(sub, userId);
    expect(row.billing_cycle).toBe('monthly');
    expect(row.next_billing_date).toBe('2024-02-01');

    const restored = subscriptionMapper.fromRow(row);
    expect(restored.billingCycle).toBe('monthly');
    expect(restored.price).toBe(15.99);
    expect(restored.name).toBe('Netflix');
  });
});

// ─── TabGroupTemplate ───────────────────────────────────────────────────────

describe('tabGroupTemplateRawMapper', () => {
  const template: TabGroupTemplate = {
    key: 'Dev-blue',
    title: 'Dev',
    color: 'blue',
    tabs: [{ url: 'https://github.com', title: 'GitHub', favIconUrl: '' }],
    savedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    pinned: true,
  };

  it('round-trips tab group template', () => {
    const row = tabGroupTemplateRawMapper.toRow(template, userId);
    expect(row.key).toBe('Dev-blue');
    expect(row.saved_at).toBe('2024-01-01T00:00:00Z');

    const restored = tabGroupTemplateRawMapper.fromRow(row);
    expect(restored.key).toBe('Dev-blue');
    expect(restored.savedAt).toBe('2024-01-01T00:00:00Z');
    expect(restored.tabs).toHaveLength(1);
  });
});

// ─── Bookmark ───────────────────────────────────────────────────────────────

describe('bookmarkCategoryMapper', () => {
  const cat: BookmarkCategory = {
    id: 'cat-1',
    boardId: 'board-1',
    name: 'Dev Links',
    icon: '🔗',
    color: '#0000ff',
    bookmarkIds: ['bm-1', 'bm-2'],
    collapsed: false,
    colSpan: 3,
    rowSpan: 2,
    cardType: 'bookmark',
    noteContent: undefined,
    parentCategoryId: undefined,
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('toRow maps fields correctly', () => {
    const row = bookmarkCategoryMapper.toRow(cat, userId);
    expect(row.board_id).toBe('board-1');
    expect(row.card_type).toBe('bookmark');
    expect(row.col_span).toBe(3);
  });

  it('fromRowWithContext reconstructs with bookmarkIds', () => {
    const row = bookmarkCategoryMapper.toRow(cat, userId);
    const restored = bookmarkCategoryFromRowWithContext(row, ['bm-1', 'bm-2'], '2024-01-01T00:00:00Z');
    expect(restored.id).toBe('cat-1');
    expect(restored.boardId).toBe('board-1');
    expect(restored.bookmarkIds).toEqual(['bm-1', 'bm-2']);
  });
});

describe('bookmarkEntryMapper', () => {
  const entry: BookmarkEntry = {
    id: 'bm-1',
    categoryId: 'cat-1',
    title: 'GitHub',
    url: 'https://github.com',
    favIconUrl: 'https://github.com/favicon.ico',
    addedAt: '2024-01-01T00:00:00Z',
    isNative: false,
    description: 'Code hosting',
  };

  it('toRow maps categoryId to folder_id', () => {
    const row = bookmarkEntryMapper.toRow(entry, userId);
    expect(row.folder_id).toBe('cat-1');
    expect(row.fav_icon_url).toBe('https://github.com/favicon.ico');
  });

  it('fromRowWithContext maps folder_id back to categoryId', () => {
    const row = bookmarkEntryMapper.toRow(entry, userId);
    const restored = bookmarkEntryFromRowWithContext(row, '2024-01-01T00:00:00Z');
    expect(restored.categoryId).toBe('cat-1');
    expect(restored.title).toBe('GitHub');
    expect(restored.description).toBe('Code hosting');
  });
});

// ─── Todo ───────────────────────────────────────────────────────────────────

describe('todoListMapper', () => {
  const list: TodoList = {
    id: 'list-1',
    name: 'My Tasks',
    icon: '📝',
    position: 0,
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('round-trips todo list', () => {
    const row = todoListMapper.toRow(list, userId);
    expect(row.name).toBe('My Tasks');

    const restored = todoListMapper.fromRow(row);
    expect(restored.id).toBe('list-1');
    expect(restored.icon).toBe('📝');
  });
});

describe('todoItemMapper', () => {
  const item: TodoItem = {
    id: 'item-1',
    listId: 'list-1',
    text: 'Buy groceries',
    completed: true,
    priority: 'high',
    dueDate: '2024-02-01',
    position: 0,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-15T00:00:00Z',
  };

  it('round-trips todo item', () => {
    const row = todoItemMapper.toRow(item, userId);
    expect(row.list_id).toBe('list-1');
    expect(row.completed).toBe(true);
    expect(row.completed_at).toBe('2024-01-15T00:00:00Z');

    const restored = todoItemMapper.fromRow(row);
    expect(restored.listId).toBe('list-1');
    expect(restored.completed).toBe(true);
    expect(restored.priority).toBe('high');
    expect(restored.completedAt).toBe('2024-01-15T00:00:00Z');
  });

  it('handles missing optional fields with defaults', () => {
    const row = {
      id: 'item-2',
      list_id: 'list-1',
      text: 'Task',
      created_at: '2024-01-01T00:00:00Z',
    };
    const restored = todoItemMapper.fromRow(row);
    expect(restored.completed).toBe(false);
    expect(restored.priority).toBe('none');
    expect(restored.dueDate).toBeUndefined();
    expect(restored.completedAt).toBeUndefined();
  });
});
