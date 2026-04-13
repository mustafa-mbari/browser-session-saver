/**
 * handlers/index.ts — Register-all bootstrap for the SyncEngine.
 *
 * Called once at service-worker startup. Instantiates a fresh SyncEngine,
 * registers every entity handler, and returns the ready-to-use engine.
 */

import { SyncEngine } from '../engine/sync-engine';
import { createSessionHandler } from './session.handler';
import {
  createPromptHandler,
  createPromptFolderHandler,
  createSubscriptionHandler,
  createTabGroupHandler,
} from './chrome-local.handlers';
import {
  createBookmarkFolderHandler,
  createBookmarkEntryHandler,
  createTodoListHandler,
  createTodoItemHandler,
  createQuickLinkHandler,
} from './newtab.handlers';

let _engine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (_engine) return _engine;
  const engine = new SyncEngine();

  engine.register(createBookmarkFolderHandler());
  engine.register(createBookmarkEntryHandler());
  engine.register(createTodoListHandler());
  engine.register(createTodoItemHandler());
  engine.register(createSessionHandler());
  engine.register(createPromptFolderHandler());
  engine.register(createPromptHandler());
  engine.register(createSubscriptionHandler());
  engine.register(createTabGroupHandler());
  engine.register(createQuickLinkHandler());

  _engine = engine;
  return engine;
}

/** Test helper — resets the singleton so tests can inject fakes. */
export function resetSyncEngineForTests(): void {
  _engine = null;
}
