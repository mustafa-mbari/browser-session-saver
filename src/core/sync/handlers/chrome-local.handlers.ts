/**
 * chrome-local.handlers.ts — Handlers for entities stored in
 * chrome.storage.local via ChromeLocalArrayRepository.
 *
 * Covers: subscriptions, prompts, prompt_folders, tab_group_templates.
 */

import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { Subscription } from '@core/types/subscription.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { EntitySyncHandler, HandlerRepository } from './types';
import type { SyncableEntity } from '../types/syncable';

import {
  promptMapper,
  promptFolderMapper,
  subscriptionMapper,
  tabGroupTemplateMapper,
} from '@core/services/sync/row-mappers';
import { wrapMapper } from './wrap-mapper';
import { ChromeLocalArrayRepository } from '@core/storage/chrome-local-array-repository';

// ─── Singleton repositories ──────────────────────────────────────────────────
//
// These intentionally mirror the keys used by the existing storage adapters
// (see subscription-storage.ts and prompt-storage.ts). The engine talks
// directly to the repositories now; the older *Storage helper modules remain
// as the service-facing facade.

let _subsRepo: ChromeLocalArrayRepository<Subscription> | null = null;
function subsRepo(): ChromeLocalArrayRepository<Subscription> {
  if (!_subsRepo) _subsRepo = new ChromeLocalArrayRepository<Subscription>('subscriptions');
  return _subsRepo;
}

let _promptsRepo: ChromeLocalArrayRepository<Prompt> | null = null;
function promptsRepo(): ChromeLocalArrayRepository<Prompt> {
  if (!_promptsRepo) _promptsRepo = new ChromeLocalArrayRepository<Prompt>('prompts');
  return _promptsRepo;
}

let _promptFoldersRepo: ChromeLocalArrayRepository<PromptFolder & { updatedAt: string }> | null =
  null;
function promptFoldersRepo(): ChromeLocalArrayRepository<PromptFolder & { updatedAt: string }> {
  if (!_promptFoldersRepo) {
    _promptFoldersRepo = new ChromeLocalArrayRepository<PromptFolder & { updatedAt: string }>(
      'prompt_folders',
    );
  }
  return _promptFoldersRepo;
}

type TabGroupRow = TabGroupTemplate & { id: string; createdAt: string };
let _tabGroupsRepo: ChromeLocalArrayRepository<TabGroupRow> | null = null;
function tabGroupsRepo(): ChromeLocalArrayRepository<TabGroupRow> {
  if (!_tabGroupsRepo) {
    _tabGroupsRepo = new ChromeLocalArrayRepository<TabGroupRow>('tab_group_templates');
  }
  return _tabGroupsRepo;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export function createSubscriptionHandler(): EntitySyncHandler<Subscription & SyncableEntity> {
  const mapped = wrapMapper(
    subscriptionMapper as unknown as Parameters<typeof wrapMapper>[0],
  );
  return {
    key: 'subscriptions',
    tableName: 'tracked_subscriptions',
    repo: subsRepo() as unknown as HandlerRepository<Subscription & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (
      row: Record<string, unknown>,
    ) => Subscription & SyncableEntity,
  };
}

export function createPromptHandler(): EntitySyncHandler<Prompt & SyncableEntity> {
  const mapped = wrapMapper(promptMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'prompts',
    tableName: 'prompts',
    repo: promptsRepo() as unknown as HandlerRepository<Prompt & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (row: Record<string, unknown>) => Prompt & SyncableEntity,
  };
}

export function createPromptFolderHandler(): EntitySyncHandler<
  PromptFolder & SyncableEntity & { updatedAt: string }
> {
  const mapped = wrapMapper(promptFolderMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'prompt_folders',
    tableName: 'prompt_folders',
    repo: promptFoldersRepo() as unknown as HandlerRepository<
      PromptFolder & SyncableEntity & { updatedAt: string }
    >,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (
      row: Record<string, unknown>,
    ) => PromptFolder & SyncableEntity & { updatedAt: string },
  };
}

export function createTabGroupHandler(): EntitySyncHandler<TabGroupRow & SyncableEntity> {
  const mapped = wrapMapper(tabGroupTemplateMapper as unknown as Parameters<typeof wrapMapper>[0]);
  return {
    key: 'tab_group_templates',
    tableName: 'tab_group_templates',
    repo: tabGroupsRepo() as unknown as HandlerRepository<TabGroupRow & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (
      row: Record<string, unknown>,
    ) => TabGroupRow & SyncableEntity,
  };
}
