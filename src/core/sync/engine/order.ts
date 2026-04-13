/**
 * order.ts — Hardcoded parent→child ordering for the SyncEngine.
 *
 * Why hardcoded: only two real parent→child pairs exist (bookmark folders
 * before entries, todo lists before items). A topological sort would be
 * over-engineering. A flat array that we literally eyeball is more obvious
 * and fails loudly if it drifts.
 *
 * Push order is parent-first so that when a child arrives on the remote
 * side there is a parent to attach to. Delete order is child-first so that
 * tombstoned parents don't FK-cascade through child rows the remote side
 * hasn't seen yet.
 */

import type { SyncEntityKey } from '../types/syncable';

export const PUSH_ORDER: readonly SyncEntityKey[] = [
  'bookmark_folders',
  'bookmark_entries',
  'todo_lists',
  'todo_items',
  'sessions',
  'prompt_folders',
  'prompts',
  'subscriptions',
  'tab_group_templates',
  'quick_links',
] as const;

/** Child-first — used only for cascading delete propagation. */
export const DELETE_ORDER: readonly SyncEntityKey[] = [
  'bookmark_entries',
  'bookmark_folders',
  'todo_items',
  'todo_lists',
  'sessions',
  'prompts',
  'prompt_folders',
  'subscriptions',
  'tab_group_templates',
  'quick_links',
] as const;
