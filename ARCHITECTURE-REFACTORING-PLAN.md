# Unified Module Architecture — Refactoring Plan

## Context

Browser Hub has 6 entity modules (Sessions, Subscriptions, Prompts, Tab Groups, Bookmarks, Todos) each built with different patterns — different storage abstractions, different service styles, and duplicated sync logic in a 1100+ line monolith (`sync.service.ts`). This makes the codebase hard to maintain, extend, and reason about. This plan introduces shared interfaces and generic abstractions so all modules follow one consistent pattern.

---

## Current Problems

| Problem | Where | Impact |
|---------|-------|--------|
| **6 different storage patterns** | `indexeddb.ts`, `subscription-storage.ts`, `tab-group-template-storage.ts`, `prompt-storage.ts`, `newtab-storage.ts`, `chrome-storage.ts` | No shared CRUD contract; each module has unique method names/signatures |
| **4 different service styles** | Factory functions (sessions), object literals (subscriptions, prompts), static class (tab groups), standalone functions with `db` param (bookmarks, todos) | Inconsistent DI, hard to mock uniformly |
| **No common entity base** | All type files in `src/core/types/` | No shared `id`+`createdAt`+`updatedAt` contract; TabGroupTemplate uses `key` not `id` |
| **Monolithic sync orchestrator** | `src/core/services/sync.service.ts` (~1136 lines) | Per-entity sync logic, row mappers, quota enforcement all duplicated inline |
| **Manual row mappers** | `sync.service.ts` lines ~728-1122 | Each entity has hand-written `toRow`/`fromRow`; no shared pattern |
| **Duplicated quota enforcement** | `sync.service.ts` per-entity functions | Same sort-slice-limit pattern repeated 6 times |

---

## Proposed Architecture

### Layer Diagram

```
UI (Sidepanel / NewTab / Popup)
  │
  ▼
Services (business logic — standalone functions)
  │
  ▼
IRepository<T> (unified CRUD interface)
  │
  ├── ChromeLocalArrayRepository<T>  (subscriptions, prompts, tab-groups)
  ├── IndexedDBRepository<T>         (sessions)
  └── NewTabDBRepository<T>          (bookmarks, todos)
  │
  ▼
Sync Layer
  ├── SyncAdapter<T>     (generic push/pull/reconcile per entity)
  ├── RowMapper<T>       (camelCase ↔ snake_case per entity)
  ├── enforceQuota()     (shared sort-slice utility)
  └── SyncOrchestrator   (coordinates all adapters)
```

---

## Phase 1: Foundation Types & Interfaces (No Breaking Changes)

All new files — nothing existing is modified. Zero risk.

### 1.1 Base Entity Types

**New file: `src/core/types/base.types.ts`**

```typescript
/** Common fields for all persistable entities */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: string; // ISO 8601
}

/** Entities that track mutation timestamps */
export interface MutableEntity extends BaseEntity {
  updatedAt: string;
}

/** Marker: entity can be synced to Supabase */
export interface Syncable extends BaseEntity {}

/** Bidirectional camelCase ↔ snake_case mapper */
export interface RowMapper<T extends Syncable> {
  toRow(entity: T, userId: string): Record<string, unknown>;
  fromRow(row: Record<string, unknown>): T;
}
```

**Why `Syncable` extends `BaseEntity` not `MutableEntity`**: `Subscription` has `createdAt` but no `updatedAt`; `BookmarkEntry` uses `addedAt`. The sync layer only needs `id` + `createdAt`.

### 1.2 Repository Interface

**New file: `src/core/storage/repository.ts`**

```typescript
export interface IRepository<T extends BaseEntity> {
  getById(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  update(id: string, updates: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface IIndexedRepository<T extends BaseEntity> extends IRepository<T> {
  getByIndex(indexName: string, value: IDBValidKey | boolean, limit?: number): Promise<T[]>;
}

export interface IBulkRepository<T extends BaseEntity> extends IRepository<T> {
  importMany(entities: T[]): Promise<void>;
  replaceAll(entities: T[]): Promise<void>;
}
```

### 1.3 Repository Implementations

**New file: `src/core/storage/chrome-local-array-repository.ts`**
- Wraps existing `ChromeLocalKeyAdapter<T>` internally
- Implements `IRepository<T>` + `IBulkRepository<T>`
- Same read-modify-write pattern as current `SubscriptionStorage`, but behind a standard interface

**New file: `src/core/storage/indexeddb-repository.ts`**
- Wraps existing `IndexedDBAdapter` pattern
- Implements `IIndexedRepository<T>` + `IBulkRepository<T>`
- Same IDB logic as current `indexeddb.ts`, exposed via standard interface

**New file: `src/core/storage/newtab-repository.ts`**
- Wraps existing `NewTabDB` singleton for a specific store
- Implements `IRepository<T>` + `IIndexedRepository<T>`

### 1.4 Sync Abstractions

**New directory: `src/core/services/sync/`**

| File | Purpose |
|------|---------|
| `types.ts` | `SyncStatus`, `SyncResult`, `UserQuota`, `SyncUsage` (moved from sync.service.ts) |
| `sync-adapter.ts` | Generic `SyncAdapter<T extends Syncable>` with `push()`, `pull()`, `reconcile()` |
| `quota.ts` | `enforceQuota<T>(entities, { limit, sortField })` — shared sort-slice utility |
| `url-filter.ts` | `isExcludedUrl()`, `collectAllSyncableUrls()` — extracted from sync.service.ts |
| `row-mappers/session.mapper.ts` | `sessionMapper: RowMapper<Session>` |
| `row-mappers/prompt.mapper.ts` | `promptMapper`, `promptFolderMapper` |
| `row-mappers/subscription.mapper.ts` | `subscriptionMapper` |
| `row-mappers/bookmark.mapper.ts` | `bookmarkCategoryMapper`, `bookmarkEntryMapper` |
| `row-mappers/tab-group.mapper.ts` | `tabGroupTemplateMapper` |
| `row-mappers/todo.mapper.ts` | `todoListMapper`, `todoItemMapper` |
| `index.ts` | Barrel re-exports |

**`SyncAdapter<T>` core interface:**
```typescript
class SyncAdapter<T extends Syncable> {
  constructor(supabase, config: {
    tableName: string;
    mapper: RowMapper<T>;
    conflictColumn?: string;
    quotaSortField?: 'updatedAt' | 'createdAt' | 'savedAt';
    preSyncTransform?: (entity: T) => T;
  })

  push(entities: T[], userId: string, limit: number | null): Promise<number>
  pull(userId: string): Promise<T[]>
  reconcile(userId: string, localKeys: string[]): Promise<void>
}
```

### 1.5 New Tests

- `tests/unit/storage/chrome-local-array-repository.test.ts`
- `tests/unit/storage/newtab-repository.test.ts`
- `tests/unit/services/sync/sync-adapter.test.ts`
- `tests/unit/services/sync/quota.test.ts`
- `tests/unit/services/sync/row-mappers/*.test.ts` (one per entity)

### 1.6 Result Type (Optional Utility)

**New file: `src/core/types/result.types.ts`**
```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Used in new code only; not retrofitted to existing functions.

---

## Phase 2: Migrate Subscriptions + Tab Groups (Simplest Modules)

### Subscriptions

**Modify: `src/core/storage/subscription-storage.ts`**
- Internally delegate to `ChromeLocalArrayRepository<Subscription>('subscriptions')`
- Keep the same public API (`SubscriptionStorage.getAll()`, `.save()`, `.delete()`, etc.) as a facade
- `CustomCategory` storage stays separate (it's not a `BaseEntity` — no `id` field conformance needed)

**Modify: `src/core/services/sync.service.ts`** (or the new orchestrator)
- `syncSubscriptions()` replaced with `subscriptionSync.push()` using `SyncAdapter<Subscription>`
- `pullSubscriptions()` replaced with `subscriptionSync.pull()`

### Tab Groups

**Special handling: `TabGroupTemplate` uses `key` not `id`**

Option: Create `ChromeLocalKeyedRepository<T>` — identical to `ChromeLocalArrayRepository` but accepts a configurable `keyField` parameter (default `'id'`, override to `'key'` for tab groups). This is ~10 lines different.

**Modify: `src/core/storage/tab-group-template-storage.ts`**
- Internally delegate to `ChromeLocalKeyedRepository<TabGroupTemplate>('tab_group_templates', 'key')`
- Keep same public API as facade
- Preserve the `savedAt` timestamp logic in the `upsert` method (service-layer concern)

**Modify sync**: `syncTabGroupTemplates()` → `tabGroupSync.push()` with `conflictColumn: 'key'`

### Test Impact
- Existing subscription + tab-group tests pass unchanged (public API preserved)
- Sync tests need minor mock updates

---

## Phase 3: Migrate Sessions

**New file: `src/core/storage/session-repository.ts`**
- `IndexedDBRepository<Session>` configured for `browser-hub` DB v2, `sessions` store
- Implements `IIndexedRepository<Session>` (for `getByIndex('isAutoSave', true)`)

**Modify: `src/core/storage/storage-factory.ts`**
- Add `getSessionRepository(): IIndexedRepository<Session>` alongside existing `getSessionStorage()`
- Both coexist during transition

**Modify: `src/core/services/session.service.ts`**
- Switch from `getSessionStorage()` (IStorage) to `getSessionRepository()` (IRepository)
- Method by method — `saveSession`, `getSession`, `updateSession`, `deleteSession`, etc.
- `getByIndex('isAutoSave', true)` works via `IIndexedRepository`

**Modify sync**: `syncSessions()` → `sessionSync.push()`, `pullSessions()` → `sessionSync.pull()`

### Risk
- Session is the most-tested module — mock structure changes from `IStorage` to `IRepository`
- Mitigation: migrate one function at a time, run tests after each

---

## Phase 4: Migrate Prompts

**Create 4 repositories:**
- `ChromeLocalArrayRepository<Prompt>('prompts')`
- `ChromeLocalArrayRepository<PromptFolder>('prompt_folders')`
- `ChromeLocalArrayRepository<PromptCategory>('prompt_categories')`
- `ChromeLocalArrayRepository<PromptTag>('prompt_tags')`

**Modify: `src/core/storage/prompt-storage.ts`**
- Internal delegation to repositories
- Public API preserved as facade
- On-read migration (`migratePrompts`, folder source migration) moves to a one-time startup runner rather than per-read

**Modify sync**: `syncPrompts()` → `promptSync.push()` + `promptFolderSync.push()` (folders first for FK ordering)

---

## Phase 5: Migrate Bookmarks + Todos

**Create repositories wrapping `newtabDB` singleton:**
- `NewTabDBRepository<Board>(newtabDB, 'boards')`
- `NewTabDBRepository<BookmarkCategory>(newtabDB, 'bookmarkCategories')`
- `NewTabDBRepository<BookmarkEntry>(newtabDB, 'bookmarkEntries')`
- `NewTabDBRepository<TodoList>(newtabDB, 'todoLists')`
- `NewTabDBRepository<TodoItem>(newtabDB, 'todoItems')`

**Modify: `src/core/services/bookmark.service.ts`**
- Remove `db: NewTabDB` parameter from all functions
- Use repository singletons internally
- All call sites in newtab components updated (remove first argument)

**Modify: `src/core/services/todo.service.ts`** — same pattern

**Modify: `src/core/services/quicklinks.service.ts`** — same pattern

**Modify sync**: bookmark/todo sync functions → `SyncAdapter<T>` instances

### Risk
- Highest number of call-site changes (~50+ function calls lose `db` param)
- Mitigation: purely mechanical, grep-verifiable

---

## Phase 6: Decompose sync.service.ts

**Goal:** Replace the 1136-line monolith with the `sync/` directory.

1. Move types → `sync/types.ts`
2. Move row mappers → `sync/row-mappers/*.ts` (already extracted in Phase 1)
3. Move orchestration → `sync/sync-orchestrator.ts`
4. **`src/core/services/sync.service.ts` becomes a barrel re-export:**
   ```typescript
   export { syncAll, pullAll, getSyncStatus, pushSession, ... } from './sync/sync-orchestrator';
   export type { SyncStatus, SyncResult, UserQuota, ... } from './sync/types';
   ```
5. Zero import breakage — all existing `import { ... } from '@core/services/sync.service'` still works

---

## Phase 7: Clean Up Legacy Artifacts

- Remove `IStorage` usage from session service (now uses `IRepository`)
- Remove `getSessionStorage()` from `storage-factory.ts` if unused
- Remove facade wrappers from `SubscriptionStorage` / `TabGroupTemplateStorage` if all consumers use repositories directly
- Update `CLAUDE.md` to document new architecture patterns

---

## What Does NOT Change

- **Supabase schema** — no column renames; `RowMapper` handles the bridge
- **`IStorage` interface** — remains for settings (settings are not entities)
- **`ChromeLocalKeyAdapter`** — stays as internal detail of `ChromeLocalArrayRepository`
- **`NewTabDB` class** — stays as internal detail of `NewTabDBRepository`
- **Message dispatcher** (`event-listeners.ts`) — not refactored here
- **State management** (Zustand vs useState vs messaging) — architectural constraint of Chrome extensions
- **UI components** — no changes
- **Existing `SubscriptionService` / `PromptService`** (pure business logic objects) — stay as-is

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking session tests (Phase 3) — mock structure changes | High | Medium | Migrate one function at a time; run tests after each |
| `TabGroupTemplate.key` vs `id` type conflicts | Medium | Low | `ChromeLocalKeyedRepository<T>` with configurable keyField |
| Prompt on-read migration breaks after repo move | Medium | High | Move to one-time startup migration; write migration tests first |
| 50+ call-site changes for bookmark/todo `db` param (Phase 5) | Low | Medium | Purely mechanical; grep-verifiable; single-commit change |
| Performance from repo wrapper indirection | Very Low | Low | One extra function call; no data copies |
| Sync adapter doesn't handle special cases (todo harvesting from dashboard cards) | Medium | Medium | `preSyncTransform` hook + keep orchestrator-level logic for complex cases |

---

## Dependency Graph

```
Phase 1 (Foundation) ─── no existing files modified
   │
   ├──▶ Phase 2 (Subscriptions + Tab Groups)
   │
   ├──▶ Phase 3 (Sessions)
   │
   ├──▶ Phase 4 (Prompts)
   │
   └──▶ Phase 5 (Bookmarks + Todos)
           │
           └──▶ Phase 6 (Decompose sync.service.ts)
                   │
                   └──▶ Phase 7 (Cleanup)
```

Phases 2-5 can run in parallel after Phase 1 but sequential is safer. Phase 6 depends on all entity migrations being complete. Phase 7 is strictly last.

---

## Verification Plan

After each phase:
1. `npm test` — all 256+ existing tests pass
2. `npm run build` — TypeScript compilation succeeds with zero errors
3. `npm run lint` — no new lint violations
4. Manual smoke test: load extension in Chrome, verify sidepanel + newtab work
5. For sync phases: verify cloud sync round-trip (push → verify in Supabase dashboard → pull on fresh profile)

---

## Critical Files

| File | Role in Refactoring |
|------|-------------------|
| `src/core/storage/storage.interface.ts` | Existing `IStorage`; new `IRepository` lives alongside |
| `src/core/storage/chrome-local-key-adapter.ts` | Internal building block for `ChromeLocalArrayRepository` |
| `src/core/storage/indexeddb.ts` | Internal building block for `IndexedDBRepository` |
| `src/core/storage/newtab-storage.ts` | Internal building block for `NewTabDBRepository` |
| `src/core/storage/subscription-storage.ts` | Phase 2 migration target |
| `src/core/storage/tab-group-template-storage.ts` | Phase 2 migration target |
| `src/core/storage/prompt-storage.ts` | Phase 4 migration target |
| `src/core/storage/storage-factory.ts` | Phase 3 — add `getSessionRepository()` |
| `src/core/services/session.service.ts` | Phase 3 migration target |
| `src/core/services/bookmark.service.ts` | Phase 5 migration target |
| `src/core/services/todo.service.ts` | Phase 5 migration target |
| `src/core/services/quicklinks.service.ts` | Phase 5 migration target |
| `src/core/services/sync.service.ts` | Phase 6 decomposition target (~1136 lines → ~6 files) |
| `src/core/types/session.types.ts` | Reference for `Session` conformance to `BaseEntity` |
| `src/core/types/subscription.types.ts` | Reference for `Subscription` conformance |
| `src/core/types/prompt.types.ts` | Reference for `Prompt`/`PromptFolder` conformance |
| `src/core/types/tab-group.types.ts` | Reference for `TabGroupTemplate` (`key` vs `id`) |
| `src/core/types/newtab.types.ts` | Reference for bookmark/todo types |
