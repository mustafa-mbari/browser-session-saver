# Import / Export Redesign — Plan

> Status: **Design document, not yet implemented.**
> Scope: local-only data (chrome.storage.local + IndexedDB). Cloud sync and Supabase are out of scope.
> Last updated: 2026-04-17.

---

## 1. Context & Goals

Browser Hub's current Import/Export works, but falls short in four concrete ways:

- **Flat upsert-by-id only.** Today's merge pipeline calls `importMany()` on every repository, which is a `Map<id, record>` last-write-wins write. It does not compare timestamps, does not merge fields, and does not descend into nested relationships (folder → subfolder → bookmark, board → category → entry).
- **Inconsistent ID model.** Most entities key on `id: string` produced by `crypto.randomUUID()`, but `TabGroupTemplate` uses a derived `key` (`"${title}-${color}"`), `CustomCategory` uses `value` (slug), and `PromptTag` has no `createdAt`. Generic code can't treat these uniformly.
- **Partial coverage.** Wallpapers, schema versioning, and integrity checks are missing. New entity types require changes in three places (types, export service, import service).
- **Silent data loss.** When a user edits a record locally and then re-imports a file they exported earlier, the local edits are silently overwritten — the user is never asked.

This document specifies the redesign. It addresses all four problems, and adds an **interactive conflict resolution UX** so the user — not the algorithm — decides what happens to each conflict.

### Goals

1. **Robust hierarchical merging** — recursive, deterministic, idempotent with respect to the user's decisions.
2. **Unified ID system** — every persistable record has `id: string` + `createdAt: string` + `updatedAt: string`, generated via `crypto.randomUUID()` once at creation and never rewritten on import/export.
3. **Full data coverage** — every entity the user creates today is backed up and restorable: sessions, tabs, tab groups, boards, bookmark folders/entries, quick links, todos, subscriptions, prompts (+folders, categories, tags), tab-group templates, extension settings, newtab settings, and wallpapers.
4. **Standardized contract** — one envelope schema, one merge algorithm, one registry. New entities plug into the registry instead of touching the export/import services directly.

### Non-goals

- No change to sync/Supabase integration.
- No breaking change to existing v2.0 backup files — they remain importable.
- No change to the on-disk storage layout for existing entities, beyond adding `id` and `createdAt` to the three outliers.

---

## 2. Unified ID strategy

**Every persistable record MUST have:**
- `id: string` — UUIDv4, generated at creation via `crypto.randomUUID()` (wrapped by `generateId()` in `src/core/utils/uuid.ts`).
- `createdAt: string` — ISO 8601, stamped at creation.
- `updatedAt: string` — ISO 8601, stamped on every mutation. Used as the primary signal for "newer" in conflict resolution.

**Three entities need upgrades:**

| Entity | Current | After |
|---|---|---|
| `TabGroupTemplate` | keyed on `key = "${title}-${color}"`, no `id` | add `id: string` (UUIDv4) as the primary merge key; `key` retained as a unique constraint to prevent duplicates on save |
| `CustomCategory` (subscription) | keyed on `value` (slug), no `id`, no `createdAt` | add `id: string` and `createdAt: string`; `value` retained as a unique natural key and as the FK from `Subscription.category` |
| `PromptTag` | has `id`, missing `createdAt` | add `createdAt: string`; existing tags are migrated by stamping `createdAt = now` on first read after upgrade |

**Migration strategy** for the three outliers: lazy, read-time. On the first load after the upgrade, a migration helper stamps missing fields and writes back. No one-shot batch migration — this keeps the extension upgrade path quiet.

**Stable-ID invariant:**
- The import pipeline MUST NEVER generate a new `id` for a record that already has one. Merging depends on stable IDs.
- Records that arrive *without* an `id` (foreign HTML bookmarks, hand-edited JSON) are assigned one at import time, **after** the natural-key lookup has run (see §4).

---

## 3. Envelope schema v3.0

A new envelope version is introduced: `FULL_BACKUP_VERSION = '3.0.0'`. v2 files remain importable via a v2→v3 adapter that runs inside `previewImport()`.

```jsonc
{
  "version": "3.0.0",
  "source": "browser-hub-full-backup",
  "exportedAt": "2026-04-17T10:30:00.000Z",
  "sourceDeviceId": "opaque-device-fingerprint",  // optional

  "schema": {
    "sessions": { "version": 1 },
    "bookmarks": { "version": 1 },
    "prompts": { "version": 2 },
    "subscriptions": { "version": 1 },
    "tabGroupTemplates": { "version": 2 },
    "todos": { "version": 1 },
    "quickLinks": { "version": 1 },
    "settings": { "version": 1 },
    "newtabSettings": { "version": 1 },
    "wallpapers": { "version": 1 }
  },

  "counts": { /* per-entity record counts */ },

  "integrity": {
    "recordCount": 1234,
    "checksum": "sha256:abc123..."  // over canonicalized JSON body, optional
  },

  // Flat record arrays, each module optional:
  "sessions": [ /* Session[] — tabs/tabGroups remain embedded */ ],
  "boards": [ /* Board[] */ ],
  "bookmarkCategories": [ /* BookmarkCategory[] */ ],
  "bookmarkEntries": [ /* BookmarkEntry[] */ ],
  "quickLinks": [ /* QuickLink[] */ ],
  "todoLists": [ /* TodoList[] */ ],
  "todoItems": [ /* TodoItem[] */ ],
  "prompts": [ /* Prompt[] */ ],
  "promptFolders": [ /* PromptFolder[] */ ],
  "promptCategories": [ /* PromptCategory[] */ ],
  "promptTags": [ /* PromptTag[] */ ],
  "subscriptions": [ /* Subscription[] */ ],
  "subscriptionCategories": [ /* CustomCategory[] */ ],
  "tabGroupTemplates": [ /* TabGroupTemplate[] */ ],
  "wallpapers": [ /* WallpaperImage[] — base64-encoded blob field */ ],
  "settings": { /* Settings */ },
  "newtabSettings": { /* NewTabSettings */ }
}
```

**Design notes:**

- **Flat record arrays, not nested trees.** Hierarchy is expressed by `parentId` / FK fields (`boardId`, `categoryId`, `listId`, `parentCategoryId`, `folderId`, `parentId`). The one exception is `Session.tabs[]` / `Session.tabGroups[]` — these remain embedded because a session is an atomic snapshot, not a live graph.
- **Per-entity `schema` versions** allow independent migration. Bumping `schema.prompts.version` from 2→3 triggers only the prompts adapter, not the whole file.
- **Checksum is optional.** It's verified when present and warns (not fails) on mismatch — we don't want a stray byte to block a user from restoring their data.
- **`sourceDeviceId` is opaque and optional.** Used only for analytics/audit, never for merge logic.

---

## 4. Merge algorithm

This is the core contribution of the redesign.

### 4.1 Pipeline shape

```
parse → detect conflicts → ask user (modal) → apply decisions → write
```

Each stage is pure over its inputs, which makes the whole flow testable and cancelable. Cancel at any pre-write stage produces zero writes.

### 4.2 Identity resolution

For each incoming record, the merge engine searches for a matching local record in this order:

1. **By `id`.** If the incoming record has an `id` that exists locally, it's a match.
2. **By `naturalKey(record)`.** If no `id` match, fall through to a per-entity natural key. If one matches, treat as the same record (the incoming record's `id` is rewritten to the local one).
3. **No match.** Insert as a new record. If the incoming record has no `id`, generate one.

**Natural keys per entity:**

| Entity | Natural key |
|---|---|
| Session | `(name, createdAt)` — tie-break duplicates from the same device |
| Board | `name` |
| BookmarkCategory | `(boardId, name, parentCategoryId)` |
| BookmarkEntry | `(categoryId, url)` |
| QuickLink | `url` |
| TodoList | `name` |
| TodoItem | `(listId, text, createdAt)` |
| Prompt | `(folderId, title)` |
| PromptFolder | `(parentId, name, source)` |
| PromptCategory | `name` |
| PromptTag | `name` |
| Subscription | `name` |
| CustomCategory | `value` |
| TabGroupTemplate | `key` (i.e., `"${title}-${color}"`) |
| WallpaperImage | `id` only (blobs don't have a natural key) |

App-seeded records use deterministic prefixes (`af-*`, `mf-*`, `demo-*` — see `src/core/storage/prompt-storage.ts`). These IDs collide stably across devices, so `id` matching handles them correctly.

### 4.3 Conflict detection

A **conflict** exists when a local record and an incoming record resolve to the same identity AND at least one `comparableField` differs.

Per entity, the `Mergeable` descriptor declares:
- `comparableFields` — which fields participate in diff.
- `protectedFields` — fields that are ALWAYS kept local (e.g., `usageCount`, `lastUsedAt`, `isPinned`, `isFavorite` for prompts; `dirty`, `lastSyncedAt`, `deletedAt` for all entities). These are never surfaced as conflicts — they belong to the local interaction history.

### 4.4 Interactive resolution (Conflict Resolution Modal)

If the detection pass finds ≥1 conflict, the user sees a modal **before any writes happen**.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ 24 conflicts across 4 entity types             [×]          │
│─────────────────────────────────────────────────────────────│
│ Bulk: [Keep all local] [Use all imported] [Newer by ↻date] │
│─────────────────────────────────────────────────────────────│
│ ▼ Prompts (12)       [Keep all] [Use imported] [Newer]     │
│   • "Blog Post Intro"   local Mar 14 / imported Apr 2      │
│     ( ) Keep local  (•) Use imported  ( ) Merge fields ▸   │
│   • "Code Review"       local Apr 10 / imported Mar 20     │
│     (•) Keep local  ( ) Use imported  ( ) Merge fields ▸   │
│ ▼ Bookmarks (8)       [Keep all] [Use imported] [Newer]    │
│   • https://example.com                                    │
│     ( ) Keep local  ( ) Use imported  (•) Merge fields ▾   │
│       title:  (•) "Example" ( ) "Example Site"             │
│       description: ( ) "(local)" (•) "(imported)"          │
│ ▶ Subscriptions (3)                                         │
│ ▶ Tab Group Templates (1)                                   │
│─────────────────────────────────────────────────────────────│
│                          [Cancel]  [Apply & Import]        │
└─────────────────────────────────────────────────────────────┘
```

**Per-row choices:**
- `Keep local` — skip the import for this record; local state unchanged.
- `Use imported` — overwrite local with the incoming record.
- `Merge fields` — expands to show each conflicting field with its own `local ⇄ imported` toggle.

**Bulk actions at three levels:**
- Global header: applies to every conflict across all entities.
- Per-entity section header: applies within that entity only.
- `Newer by updatedAt`: picks whichever side has the later `updatedAt` per record.

**Fatigue mitigation:** if the detection pass returns >100 conflicts, the modal opens with the global `Newer by updatedAt` bulk action pre-selected and a notice: "Large import — defaulted to 'newer wins'. Review or apply."

### 4.5 Silent (non-conflict) cases

These cases bypass the modal — they have no ambiguity:

| Case | Action |
|---|---|
| Only local exists | Keep local. No write. |
| Only imported exists | Insert the imported record. |
| Both exist and are byte-equal on `comparableFields` | No-op. |
| One side is soft-deleted (`deletedAt != null`), other isn't | **Surface as a conflict.** User decides whether to undelete or keep tombstoned — we never do this silently. |
| Protected-field differences only | Keep local's protected fields, no conflict shown. |

### 4.6 Recursive descent

Parent entities drive merging of their children through the registry's `children` relation. For example, when merging `Board A`:

1. Resolve `Board A` identity.
2. Compute conflict (if any) on Board-level fields.
3. For each `BookmarkCategory` that has `boardId === A.id` in the incoming payload, recurse.
4. For each `BookmarkEntry` in those categories, recurse.

Child conflicts are grouped in the modal under their parent for context ("Board 'Work' → Category 'Important' → Bookmark 'https://…'").

### 4.7 Determinism & idempotency

- Records are processed in sorted `id` order. Tie-break `updatedAt` ties with `createdAt`, then `id` lexicographically.
- `merge(inputs, decisions)` is a pure function. Same inputs + same decisions → identical final state. Verified by round-trip tests.
- Re-running the same import with the same decisions produces no further writes (idempotent).

---

## 5. Full entity coverage

The v3 envelope covers **ten modules**, up from today's six:

| Module | Includes | Today | v3 |
|---|---|---|---|
| `sessions` | Session + embedded Tab/TabGroup | ✓ | ✓ |
| `settings` | `Settings` (chrome.storage.local key `settings`) | ✓ | ✓ |
| `newtabSettings` | `NewTabSettings` (chrome.storage.local key `newtab_settings`) | bundled under `dashboard.settings` | **promoted to its own module** |
| `bookmarks` | Board + BookmarkCategory + BookmarkEntry | renamed from `dashboard` (partial) | ✓ |
| `quickLinks` | QuickLink | bundled under `dashboard` | **promoted** |
| `todos` | TodoList + TodoItem | bundled under `dashboard` | **promoted** |
| `prompts` | Prompt + PromptFolder + PromptCategory + PromptTag | ✓ | ✓ |
| `subscriptions` | Subscription + CustomCategory | ✓ | ✓ |
| `tabGroupTemplates` | TabGroupTemplate | ✓ | ✓ |
| `wallpapers` | WallpaperImage (base64-encoded blob) | ✗ excluded | **NEW — opt-in checkbox** |

**What is intentionally NOT exported:**

- `action_usage` (daily/monthly rate-limit counters) — privacy + per-device.
- `cached_plan` — re-derived from Supabase on sign-in.
- Supabase auth session — re-authenticated per device.
- Sync metadata (`dirty`, `lastSyncedAt` on individual records) — local-only flags, reset on import.

**Extensibility.** Adding an 11th entity type touches exactly one file: the `EntityRegistry`. The registry entry declares storage, natural key, comparable fields, protected fields, and children. The export service, import service, preview, and modal UI all drive from the registry.

---

## 6. Edge cases & error handling

| Case | Behavior |
|---|---|
| JSON parse error | `previewImport()` returns `{ fileType: 'unknown', errors: [...] }`. No writes. |
| Wrong `source` / `version` | Same as above — unrecognized file. |
| `version === '2.0.0'` | v2→v3 adapter runs silently; user sees v3 preview. |
| One module malformed, others OK | Per-module try/catch; failing module reported in `FullImportResult.errors`; others proceed. |
| FK orphan (BookmarkEntry references missing categoryId) | Auto-create an "Orphaned" category under the target Board, attach the entry, emit a warning. Configurable but this is the default. |
| Duplicate natural keys within the same incoming payload | Keep first occurrence, report duplicate count in result. |
| Circular folder parent chain (A→B→A) | DFS visited-set detects cycle; the deeper folder is re-parented to root with a warning. |
| chrome.storage.local quota exceeded mid-write | Rollback log records what was written, attempts to undo; user sees a descriptive error. |
| Wallpaper blob exceeds 4MB | Size-warn in export UI; during import, fail-soft (skip that wallpaper, import the rest). |
| Conflict modal cancel | No writes. Pipeline exits cleanly. |
| User closes extension mid-import | IDB writes roll back at the transaction boundary; chrome.storage.local writes don't — but they're ordered safest-first (settings last), so worst case is partial-but-consistent data. |

**Atomicity strategy:**

- **IndexedDB writes** — use a single `readwrite` transaction per store. Either all records land or none do.
- **chrome.storage.local writes** — not transactional across keys. The import pipeline orders writes so a mid-flight crash leaves recoverable state:
  1. `subscription_categories`, `prompt_categories`, `prompt_tags`, `prompt_folders` (referenced entities first)
  2. `subscriptions`, `prompts` (referencers second)
  3. `tab_group_templates`
  4. `newtab_settings`, `settings` (settings last — a half-imported prefs file is the worst recovery case)
- A rollback log is kept in memory during a replace-mode import, allowing best-effort undo on failure.

---

## 7. Standardized contract

```ts
// src/core/import-export/registry.ts (new)

type EntityName =
  | 'sessions' | 'boards' | 'bookmarkCategories' | 'bookmarkEntries'
  | 'quickLinks' | 'todoLists' | 'todoItems' | 'prompts' | 'promptFolders'
  | 'promptCategories' | 'promptTags' | 'subscriptions' | 'subscriptionCategories'
  | 'tabGroupTemplates' | 'wallpapers';

interface Mergeable<T extends BaseEntity> {
  readonly entity: EntityName;
  readonly storage: IBulkRepository<T>;

  /** Natural-key extractor used when incoming record has no id. */
  readonly naturalKey?: (record: T) => string;

  /** Fields participating in conflict detection. Everything else is either
   *  protected or derived. */
  readonly comparableFields: readonly (keyof T)[];

  /** Fields always kept from the local side — user-interaction history. */
  readonly protectedFields?: readonly (keyof T)[];

  /** FK relationships to descend into after merging this entity. */
  readonly children?: readonly ChildRelation[];
}

interface ChildRelation {
  readonly entity: EntityName;
  readonly foreignKey: string;   // field on child pointing to parent.id
  readonly cascade?: 'delete' | 'orphan-to-root';
}

// ── Conflict model ───────────────────────────────────────────────────────────

interface Conflict<T> {
  readonly entity: EntityName;
  readonly identity: string;          // local record id
  readonly local: T;
  readonly imported: T;
  readonly differingFields: readonly (keyof T)[];
}

type ConflictDecision =
  | { kind: 'keepLocal' }
  | { kind: 'useImported' }
  | { kind: 'fieldMerge'; picks: Record<string, 'local' | 'imported'> };

type ConflictResolutionMap = Map<string /* `${entity}:${id}` */, ConflictDecision>;

// ── Import pipeline ──────────────────────────────────────────────────────────

interface ImportPlan {
  readonly envelope: FullBackupEnvelope;
  readonly conflicts: readonly Conflict<unknown>[];
  readonly newInserts: Map<EntityName, number>;   // for the preview UI
  readonly warnings: readonly string[];
}

async function previewImport(raw: string): Promise<ImportPreview>;                          // parse + validate
async function planImport(preview: ImportPreview, selection: ModuleSelection): Promise<ImportPlan>;  // detect conflicts
async function executeImport(plan: ImportPlan, decisions: ConflictResolutionMap): Promise<FullImportResult>;  // apply + write
```

One `Mergeable` instance per entity type, registered in a single `EntityRegistry` object. `previewImport` → `planImport` → `executeImport` all drive off the registry. Adding an entity = adding a registry entry.

---

## 8. Testing strategy

The existing suite is 661 tests across 64 files. New tests slot in under `tests/unit/import-export/`.

**Layers:**

1. **Unit — natural key matching** — per entity, synthetic local + incoming arrays exercising all four resolution paths (`id match`, `natural-key match`, `no-id fresh insert`, `already-seeded app record`).
2. **Unit — conflict detection** — table-driven `(local, imported) → Conflict | null` tests per entity; assert `differingFields` is exactly the set of user-visible field diffs (no noise from `updatedAt` or protected fields).
3. **Unit — applier** — feed synthetic `ConflictResolutionMap` into the applier; assert the final repository state for each `ConflictDecision` kind.
4. **Integration — pipeline** — full `preview → plan → execute` over `fake-indexeddb` + mocked `chrome.storage.local`. A "no-conflict import" round-trip (`export → import → export`) produces byte-equal JSON, proving determinism.
5. **Integration — v2 adapter** — v2 fixture files in `tests/fixtures/backups/v2/` import end-to-end. Counts match. No data lost.
6. **UI — Conflict Resolution Modal** — Vitest + Testing Library:
   - Renders grouped conflicts with correct counts.
   - Per-row, per-entity, and global bulk actions apply correctly.
   - `Cancel` produces zero writes.
   - `>100 conflicts` triggers the "newer by updatedAt" default.
   - Expand/collapse of `Merge fields` view.
7. **Edge case suite** — truncated JSON; wrong schema version; FK orphans; circular folder chains; duplicate natural keys; both-deleted vs one-deleted conflict surfacing; quota-exceeded rollback.
8. **Property-based** (optional, fast-check) — commutativity/idempotency checks on the applier for non-timestamped fields.

Limit-guard mocking pattern (per CLAUDE.md) applies to all mutation tests.

---

## 9. Implementation phases

Each phase lands independently and ships behind a feature flag where noted.

| Phase | Scope | Feature flag | Risk |
|---|---|---|---|
| **A** | Normalize IDs: add `id`+`createdAt` to `CustomCategory`, `PromptTag`; add `id` to `TabGroupTemplate`. Lazy read-time migrations. | none | low — additive only |
| **B** | Introduce `EntityRegistry` + `Mergeable`. Refactor the existing v2 import to drive from the registry but keep current last-write-wins semantics. No behavior change. | none | medium — large refactor |
| **C** | Add conflict detection pass (planImport) + `ConflictResolutionMap` applier. Wire a no-op detection into the existing import so we collect telemetry on how many conflicts real imports produce. | `importExportConflictDetection` (off by default) | medium |
| **D** | Build the Conflict Resolution Modal UI. Wire it into the import pipeline. Remove the feature flag. Interactive resolution is now the default merge behavior. | flag removed | high — UX surface |
| **E** | Ship the v3 envelope: schema versioning, integrity checksum, `newtabSettings` / `quickLinks` / `todos` promoted to top-level. Keep the v2 reader for at least two releases. | none | medium |
| **F** | Add the `wallpapers` module: opt-in checkbox in export UI, base64 in the envelope, size-warned. Fail-soft on oversized wallpapers during import. | `importExportWallpapers` (on by default, easy rollback) | low |
| **G** | Consolidate `ImportExportView` (sidepanel) + `ImportExportPanel` (newtab) into a shared `<ImportExportPanel theme="sidepanel" \| "newtab">`. | none | low — pure refactor after D |

**Suggested sequencing:** A → B → (C in parallel with E design) → E → C → D → F → G.

---

## 10. Critical files

**Will be modified:**
- [src/core/types/import-export.types.ts](../src/core/types/import-export.types.ts) — v3 envelope, `Conflict`, `ConflictDecision`, `ConflictResolutionMap`, `ImportPlan`.
- [src/core/services/full-export.service.ts](../src/core/services/full-export.service.ts) — rewrite around `EntityRegistry`.
- [src/core/services/full-import.service.ts](../src/core/services/full-import.service.ts) — split into `previewImport`, `planImport`, `executeImport`.
- [src/core/services/newtab-export.service.ts](../src/core/services/newtab-export.service.ts) — absorbed into the registry-driven flow (or deprecated).
- [src/core/storage/tab-group-template-storage.ts](../src/core/storage/tab-group-template-storage.ts) — add `id` field + migration.
- [src/core/storage/subscription-storage.ts](../src/core/storage/subscription-storage.ts) — `CustomCategory` gets `id` + `createdAt` migration.
- [src/core/storage/prompt-storage.ts](../src/core/storage/prompt-storage.ts) — `PromptTag` gets `createdAt` migration.
- [src/core/types/session.types.ts](../src/core/types/session.types.ts), [src/core/types/newtab.types.ts](../src/core/types/newtab.types.ts), [src/core/types/prompt.types.ts](../src/core/types/prompt.types.ts), [src/core/types/subscription.types.ts](../src/core/types/subscription.types.ts), [src/core/types/tab-group.types.ts](../src/core/types/tab-group.types.ts) — minor field additions.
- [src/sidepanel/views/ImportExportView.tsx](../src/sidepanel/views/ImportExportView.tsx) + [src/newtab/components/ImportExportPanel.tsx](../src/newtab/components/ImportExportPanel.tsx) — consolidated in Phase G.

**Will be created:**
- `src/core/import-export/registry.ts` — `EntityRegistry`, `Mergeable` definitions.
- `src/core/import-export/merge-engine.ts` — identity resolution, conflict detection, applier.
- `src/core/import-export/v2-adapter.ts` — reads v2 files, upcasts to v3 shape.
- `src/shared/components/ConflictResolutionModal.tsx` — the interactive UI (shared by sidepanel + newtab).
- `tests/unit/import-export/*.test.ts` — tests per §8.
- `tests/fixtures/backups/v2/*.json`, `tests/fixtures/backups/v3/*.json` — golden files.

**Unchanged:**
- [src/core/types/messages.types.ts](../src/core/types/messages.types.ts) — the import/export flow runs in the UI, not through the service worker, so no new message types are needed.
- [src/core/storage/repository.ts](../src/core/storage/repository.ts) — the `IBulkRepository` interface is sufficient; no API change.
- [src/core/storage/indexeddb-repository.ts](../src/core/storage/indexeddb-repository.ts), [src/core/storage/chrome-local-array-repository.ts](../src/core/storage/chrome-local-array-repository.ts) — existing `importMany` / `replaceAll` fit the new pipeline.

---

## Open questions for future iteration

- **Cloud sync interaction.** When an import writes records, those records become `dirty: true` and will push to Supabase on the next sync. We need to confirm that's the right policy — alternative: `applyRemote` style write that doesn't mark dirty, under the assumption that the imported data already "came from somewhere". Deferred to Phase C/D implementation.
- **Wallpaper chunking.** If a user has 20 custom wallpapers averaging 2MB each, the backup JSON is 40MB+. Consider splitting wallpapers into a sidecar file (`browser-hub-backup-YYYY-MM-DD.json` + `browser-hub-wallpapers-YYYY-MM-DD.zip`). Flagged for Phase F.
- **Conflict preview diff UI.** For text-heavy fields (prompt `content`, todo `text`), a side-by-side diff beats a `local ⇄ imported` toggle. Nice-to-have for Phase D.
