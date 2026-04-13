/**
 * newtab.handlers.ts — Handlers for entities stored in the `newtab-db`
 * IndexedDB via NewTabDBRepository.
 *
 * Covers: bookmark_folders, bookmark_entries, todo_lists, todo_items,
 * quick_links.
 */

import type {
  BookmarkCategory,
  BookmarkEntry,
  QuickLink,
  TodoItem,
  TodoList,
} from '@core/types/newtab.types';
import type { EntitySyncHandler, HandlerRepository } from './types';
import type { SyncableEntity } from '../types/syncable';

import {
  bookmarkCategoryMapper,
  bookmarkEntryMapper,
  todoListMapper,
  todoItemMapper,
  quicklinkMapper,
} from '@core/services/sync/row-mappers';
import { wrapMapper } from './wrap-mapper';
import { NewTabDBRepository } from '@core/storage/newtab-repository';
import { newtabDB } from '@core/storage/newtab-storage';

// ─── Singleton repos ─────────────────────────────────────────────────────────

type BookmarkEntryRow = BookmarkEntry & { createdAt: string };
type QuickLinkRow = QuickLink & { createdAt: string };

let _bookmarkFoldersRepo: NewTabDBRepository<BookmarkCategory> | null = null;
function bookmarkFoldersRepo(): NewTabDBRepository<BookmarkCategory> {
  if (!_bookmarkFoldersRepo) {
    _bookmarkFoldersRepo = new NewTabDBRepository<BookmarkCategory>(newtabDB, 'bookmarkCategories');
  }
  return _bookmarkFoldersRepo;
}

let _bookmarkEntriesRepo: NewTabDBRepository<BookmarkEntryRow> | null = null;
function bookmarkEntriesRepo(): NewTabDBRepository<BookmarkEntryRow> {
  if (!_bookmarkEntriesRepo) {
    _bookmarkEntriesRepo = new NewTabDBRepository<BookmarkEntryRow>(newtabDB, 'bookmarkEntries');
  }
  return _bookmarkEntriesRepo;
}

let _todoListsRepo: NewTabDBRepository<TodoList> | null = null;
function todoListsRepo(): NewTabDBRepository<TodoList> {
  if (!_todoListsRepo) {
    _todoListsRepo = new NewTabDBRepository<TodoList>(newtabDB, 'todoLists');
  }
  return _todoListsRepo;
}

let _todoItemsRepo: NewTabDBRepository<TodoItem> | null = null;
function todoItemsRepo(): NewTabDBRepository<TodoItem> {
  if (!_todoItemsRepo) {
    _todoItemsRepo = new NewTabDBRepository<TodoItem>(newtabDB, 'todoItems');
  }
  return _todoItemsRepo;
}

let _quickLinksRepo: NewTabDBRepository<QuickLinkRow> | null = null;
function quickLinksRepo(): NewTabDBRepository<QuickLinkRow> {
  if (!_quickLinksRepo) {
    _quickLinksRepo = new NewTabDBRepository<QuickLinkRow>(newtabDB, 'quickLinks');
  }
  return _quickLinksRepo;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export function createBookmarkFolderHandler(): EntitySyncHandler<
  BookmarkCategory & SyncableEntity
> {
  const mapped = wrapMapper(bookmarkCategoryMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'bookmark_folders',
    tableName: 'bookmark_folders',
    repo: bookmarkFoldersRepo() as unknown as HandlerRepository<
      BookmarkCategory & SyncableEntity
    >,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (
      row: Record<string, unknown>,
    ) => BookmarkCategory & SyncableEntity,
  };
}

export function createBookmarkEntryHandler(): EntitySyncHandler<BookmarkEntryRow & SyncableEntity> {
  const mapped = wrapMapper(bookmarkEntryMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'bookmark_entries',
    tableName: 'bookmark_entries',
    repo: bookmarkEntriesRepo() as unknown as HandlerRepository<
      BookmarkEntryRow & SyncableEntity
    >,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (
      row: Record<string, unknown>,
    ) => BookmarkEntryRow & SyncableEntity,
  };
}

export function createTodoListHandler(): EntitySyncHandler<TodoList & SyncableEntity> {
  const mapped = wrapMapper(todoListMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'todo_lists',
    tableName: 'todo_lists',
    repo: todoListsRepo() as unknown as HandlerRepository<TodoList & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (row: Record<string, unknown>) => TodoList & SyncableEntity,
  };
}

export function createTodoItemHandler(): EntitySyncHandler<TodoItem & SyncableEntity> {
  const mapped = wrapMapper(todoItemMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'todo_items',
    tableName: 'todo_items',
    repo: todoItemsRepo() as unknown as HandlerRepository<TodoItem & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (row: Record<string, unknown>) => TodoItem & SyncableEntity,
  };
}

export function createQuickLinkHandler(): EntitySyncHandler<QuickLinkRow & SyncableEntity> {
  const mapped = wrapMapper(
    quicklinkMapper as unknown as Parameters<typeof wrapMapper>[0],
  );
  return {
    key: 'quick_links',
    tableName: 'quick_links',
    repo: quickLinksRepo() as unknown as HandlerRepository<QuickLinkRow & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (
      row: Record<string, unknown>,
    ) => QuickLinkRow & SyncableEntity,
  };
}
