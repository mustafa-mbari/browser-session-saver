# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser Hub is a Chrome extension (Manifest V3) that saves, restores, and manages browser sessions. It includes a Chrome Side Panel (primary UI), Start-Tab with glassmorphism UI, and a Popup for quick actions — all built with React 18 + TypeScript + Tailwind CSS.

The project also includes two companion Next.js apps:
- **`web/`** — User-facing web app (port 3000) with dashboard, billing, settings, support, suggestions
- **`admin/`** — Admin panel (port 3001) with overview, users, statistics, promo codes, subscriptions, webhooks, tickets, suggestions, quotas, emails

## Commands

### Extension (root)
```bash
npm run dev           # Vite dev server with HMR
npm run build         # tsc type-check + Vite production build → dist/
npm test              # Vitest unit tests (run once)
npm run test:watch    # Vitest in watch mode
npx vitest run tests/unit/path/to/file.test.ts  # Run a single test file
npm run lint          # ESLint
npm run format        # Prettier
```

### Web App (`web/`)
```bash
cd web && npm install && npm run dev   # Start on port 3000
cd web && npm run build                # Production build
```

### Admin App (`admin/`)
```bash
cd admin && npm install && npm run dev  # Start on port 3001
cd admin && npm run build               # Production build
```

## Architecture

- **Background service worker** (`src/background/`) — all Chrome API calls, auto-save engine, message handling
- **Core layer** (`src/core/`) — framework-agnostic types, services, storage, utilities
- **UI surfaces** — Side Panel (`src/sidepanel/`), Popup (`src/popup/`), Start-Tab (`src/newtab/`); each has its own `index.html` entry point bundled by `@crxjs/vite-plugin` from `manifest.json`
- **Shared** (`src/shared/`) — reusable components, hooks, styles, i18n utilities used by all UI surfaces

### Storage Layer

```
Services (business logic)
  │
  ├── IRepository<T> / IIndexedRepository<T> / IBulkRepository<T>
  │     └── IndexedDBRepository<T>    (sessions)
  │
  ├── ChromeLocalKeyAdapter<T>        (subscriptions, tab-group templates)
  │
  └── NewTabDB singleton (newtabDB)   (bookmarks, todos, quick links, wallpapers)
```

All data is stored **locally only** — `chrome.storage.local` and IndexedDB. No cloud sync.

- **`IRepository<T>`** (`src/core/storage/repository.ts`) — unified CRUD interface for persistable entities; extended by `IIndexedRepository<T>` (secondary index queries) and `IBulkRepository<T>` (importMany/replaceAll)
- **`IndexedDBRepository<T>`** (`src/core/storage/indexeddb-repository.ts`) — implements `IIndexedRepository` + `IBulkRepository`; used for sessions via `getSessionRepository()` in `storage-factory.ts`
- **Bookmark/todo/quicklinks services** import `newtabDB` singleton directly — no `db` parameter on public functions

## Key Conventions

- **Path aliases**: `@core/*`, `@shared/*`, `@background/*`, `@sidepanel/*`, `@popup/*`, `@newtab/*`
- **State management**: Zustand stores per UI surface (sidepanel.store.ts; newtab split into newtab-ui.store.ts + newtab-data.store.ts with facade re-export from newtab.store.ts)
- **Storage**: chrome.storage.local for settings (via `IStorage` / `ChromeStorageAdapter`), IndexedDB (`browser-hub` v2 with `isAutoSave`/`createdAt` indexes) for sessions (via `IRepository` / `IndexedDBRepository`); start-tab uses a separate `newtab-db` (`newtabDB` singleton from `src/core/storage/newtab-storage.ts`) for bookmarks/todos/wallpapers; subscriptions and tab-group templates use flat `chrome.storage.local` keys via `ChromeLocalKeyAdapter<T>`
- **Messaging**: Typed discriminated union `Message` type between service worker and UI via `chrome.runtime.sendMessage`; 19 action types defined in `messages.types.ts`
- **Styling**: Tailwind CSS with CSS custom properties for theme tokens, dark mode via `class` strategy. Glassmorphism utilities (`.glass`, `.glass-panel`, `.glass-dark`, `.glass-hover`, `.vignette`) defined in `@layer utilities` in `globals.css`
- **Components**: All shared components support dark mode and include ARIA attributes
- **Tests**: Vitest with jsdom, Chrome API mocked in `tests/setup.ts`; 661 tests across 64 files in `tests/unit/`
- **i18n**: `_locales/en/messages.json` (~282 keys), `_locales/ar/messages.json`, `_locales/de/messages.json`; `t()` wrapper at `src/shared/utils/i18n.ts`
- **Virtual scrolling**: `@tanstack/react-virtual` v3 used in `SessionsPanel` (3-column `lanes` grid) and `AutoSavesPanel` (flat list with headers); threshold ≤30 items uses plain DOM, >30 uses virtualizer
- **Error boundaries**: `src/shared/components/ErrorBoundary.tsx` wraps all major UI sections; reports via `errorBoundaryTitle/Desc/Reload` i18n keys
- **Generic storage adapter**: `src/core/storage/chrome-local-key-adapter.ts` — `ChromeLocalKeyAdapter<T>` shared by `SubscriptionStorage` and `TabGroupTemplateStorage`
- **Shared color constants**: `src/core/constants/tab-group-colors.ts` — `GROUP_COLORS` map imported by `SessionsPanel` and start-tab components
- **ContextMenu accessibility**: keyboard navigation (Enter/Space to open, Escape, ArrowUp/Down, Home/End, Tab to close); roving tabindex pattern; `requestAnimationFrame` deferred focus
- **Widget config**: `src/core/config/widget-config.ts` — `WIDGET_CONFIG` registry with per-type min/max/default sizes, `getDefaultSize()`, `clampSize()` utilities
- **View unions**:
  - `SidePanelView`: `'home' | 'session-detail' | 'tab-groups' | 'settings' | 'import-export' | 'subscriptions' | 'prompts'`
  - `NewTabView`: `'bookmarks' | 'folder-explorer' | 'sessions' | 'auto-saves' | 'tab-groups' | 'import-export' | 'subscriptions' | 'prompts' | 'settings'`
  - `CardType`: `'bookmark' | 'clock' | 'note' | 'todo' | 'subscription' | 'tab-groups' | 'prompt-manager'`
- **Supabase**: `@supabase/supabase-js` retained for auth only (sign-in, sign-out, plan tier fetch). No sync. `chrome.storage.local` used as the auth storage adapter. Env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` injected at build time; placeholder fallbacks prevent test-time throws.
- **Action-based limits**: All mutations are guarded by `guardAction()` and tracked by `trackAction()` in `src/core/services/limits/limit-guard.ts`. Tiers: Guest (3/day, 20/month), Free (6/day, 30/month), Pro (50/day, 500/month), Lifetime (90/day, 900/month). Counts stored in `action_usage` key in `chrome.storage.local`; plan tier cached in `cached_plan` key.

## Important Files

- `public/manifest.json` — Chrome Manifest V3 with permissions (`tabs`, `tabGroups`, `storage`, `alarms`, `idle`, `sidePanel`, `activeTab`, `topSites`, `bookmarks`), `optional_permissions: [history]`, `host_permissions: ["https://*.supabase.co/*"]`, side_panel, and `chrome_url_overrides.newtab`
- `src/core/types/session.types.ts` — Core data model (Session, Tab, TabGroup, AutoSaveTrigger, ChromeGroupColor)
- `src/core/types/newtab.types.ts` — Start-tab data models: Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoItem, TodoList, NewTabSettings, CardType, GRADIENT_PRESETS
- `src/core/types/messages.types.ts` — Message protocol between SW and UI (19 action types)
- `src/core/types/prompt.types.ts` — Prompt, PromptFolder, PromptCategory, PromptTag, PromptSectionKey, PromptFilterOptions, PromptSortField
- `src/core/supabase/client.ts` — Singleton Supabase client using `chrome.storage.local` as auth storage adapter
- `src/core/services/auth.service.ts` — Supabase auth wrapper: `signIn`, `signOut`, `getSession`, `getUserId`, `isAuthenticated`, `getEmail`; on sign-in fetches plan tier via `get_user_plan_tier` RPC and calls `cachePlanTier()`
- `src/core/types/limits.types.ts` — `PlanTier`, `PLAN_LIMITS`, `ActionUsage`, `LimitStatus`
- `src/core/services/limits/action-tracker.ts` — `getActionUsage`, `incrementAction`, `getCachedPlanTier`, `cachePlanTier`, `getLimitStatus`, `canPerformAction`; storage keys: `action_usage`, `cached_plan`
- `src/core/services/limits/limit-guard.ts` — `guardAction()` (throws `ActionLimitError` when blocked), `trackAction()` (increments counter + fire-and-forget Supabase upsert for signed-in users)
- `src/shared/components/LimitReachedModal.tsx` — Modal shown when `ActionLimitError` is caught; displays usage bars and tier-appropriate CTA
- `src/core/types/subscription.types.ts` — Subscription, SubscriptionTemplate, BillingCycle, DueUrgency, SUPPORTED_CURRENCIES, SUBSCRIPTION_TEMPLATES (22 presets)
- `src/core/types/tab-group.types.ts` — TabGroupTemplate, TabGroupTemplateTab
- `src/core/config/widget-config.ts` — Widget sizing configuration registry: `WidgetSizeConfig` interface, `WIDGET_CONFIG` (per-CardType min/max/default), `getDefaultSize()`, `clampSize()`
- `src/core/storage/repository.ts` — `IRepository<T>`, `IIndexedRepository<T>`, `IBulkRepository<T>` interfaces — unified CRUD contract for persistable entities
- `src/core/storage/indexeddb-repository.ts` — `IndexedDBRepository<T>` implementing `IIndexedRepository` + `IBulkRepository`; used for sessions via `getSessionRepository()`
- `src/core/storage/indexeddb.ts` — Legacy `IndexedDBAdapter` implementing `IStorage` (`browser-hub` v2); secondary indexes (`isAutoSave`, `createdAt`), `getByIndex()` for filtered queries
- `src/core/storage/newtab-storage.ts` — Multi-store IndexedDB adapter (newtab-db v1); stores: quickLinks, boards, bookmarkCategories, bookmarkEntries, todoLists, todoItems, wallpaperImages
- `src/core/storage/chrome-local-key-adapter.ts` — Generic `ChromeLocalKeyAdapter<T>` for storing arrays under a single key; used by subscription and tab-group-template storage
- `src/core/storage/subscription-storage.ts` — Flat chrome.storage.local adapter; keys: `subscriptions` (Subscription[]), `subscription_categories` (CustomCategory[])
- `src/core/storage/tab-group-template-storage.ts` — Static class adapter; key: `tab_group_templates` in chrome.storage.local
- `src/core/constants/tab-group-colors.ts` — `GROUP_COLORS` map (ChromeGroupColor → CSS hex); imported by session and start-tab components
- `src/core/services/subscription.service.ts` — Urgency calculation, monthly normalization, analytics, CSV import/export, currency formatting
- `src/core/storage/prompt-storage.ts` — chrome.storage.local adapter; keys: `prompts`, `prompt_categories`, `prompt_tags`, `prompt_folders`; includes `source` field migration
- `src/core/services/prompt.service.ts` — `extractVariables`, `applyVariables`, `filterPrompts`, `filterBySection`, `buildFolderTree`, `sortPrompts`, `getRecentPrompts`, `getPinnedPrompts`
- `src/background/event-listeners.ts` — Central message dispatcher; session mutation handlers (SAVE/UPDATE/DELETE) call `guardAction()` before and `trackAction()` after each operation; returns `{ success: false, limitStatus }` when `ActionLimitError` is thrown
- `src/background/auto-save-engine.ts` — Auto-save trigger management; calls `upsertAutoSaveSession` so each trigger type maintains exactly one pinned entry (updated in place)
- `src/sidepanel/views/HomeView.tsx` — Slim orchestrator (~250 LOC) for sessions, current tabs, and tab groups tabs
- `src/sidepanel/components/CurrentTabsPanel.tsx` — Current browser tabs panel (extracted from HomeView)
- `src/sidepanel/components/HomeTabGroupsPanel.tsx` — Tab groups panel with live/saved sections (extracted from HomeView)
- `src/sidepanel/components/HomeLiveGroupRow.tsx` — Live tab group row with inline edit, expand, actions (extracted from HomeView)
- `src/sidepanel/components/HomeSavedGroupRow.tsx` — Saved tab group template row with restore/rename/delete (extracted from HomeView)
- `src/sidepanel/views/SubscriptionsView.tsx` — Subscription management with List/Calendar/Analytics tabs
- `src/sidepanel/views/TabGroupsView.tsx` — Live and saved tab groups management
- `src/sidepanel/views/PromptsView.tsx` — Two-pane prompt manager: left=PromptSectionNav (sections + nested folder tree), right=PromptList or StartPageContent
- `src/newtab/App.tsx` — Start-tab root component: data loading, layout selection, overlay management
- `src/newtab/stores/newtab-ui.store.ts` — UI state store (settings, layoutMode, activeView, modals, loading)
- `src/newtab/stores/newtab-data.store.ts` — Data state store (boards, categories, entries, quickLinks, todoLists, todoItems)
- `src/newtab/stores/newtab.store.ts` — Facade re-exporting `useNewTabStore` (alias for UI store), `useNewTabUIStore`, `useNewTabDataStore`, and `NewTabView` type
- `src/newtab/hooks/useNewTabSettings.ts` — Settings load/sync hook (reads `newtab_settings` key from chrome.storage.local)
- `src/newtab/components/SubscriptionReminder.tsx` — Glassmorphism toast overlay for upcoming subscription renewals (24-hour snooze)
- `src/newtab/components/BookmarkCardBody.tsx` — Bookmark widget body (split from `BookmarkCategoryCard.tsx`)
- `src/newtab/components/NoteCardBody.tsx` — Note widget body (split from `BookmarkCategoryCard.tsx`)
- `src/newtab/components/TodoCardBody.tsx` — Todo widget body (split from `BookmarkCategoryCard.tsx`)
- `src/newtab/components/BookmarkEntryRow.tsx` — Single bookmark entry row with drag handle (split from `BookmarkCategoryCard.tsx`)
- `src/newtab/components/ResizePopover.tsx` — Widget resize popover with per-type size constraints (split from `BookmarkCategoryCard.tsx`)
- `src/newtab/components/SessionsPanel.tsx` — Sessions sidebar with virtualised 3-column grid (>30 sessions)
- `src/newtab/components/AutoSavesPanel.tsx` — Auto-saves sidebar with virtualised flat list (>30 entries)
- `src/newtab/contexts/BookmarkBoardContext.tsx` — React context for `BookmarkBoardActions`; eliminates prop-drilling in start-tab board components
- `src/shared/components/ErrorBoundary.tsx` — Class component error boundary wrapping all major UI sections
- `src/core/services/newtab-settings.service.ts` — Read/write NewTabSettings via `getSettingsStorage()`

## Dashboard Layout — `isSessionView` pattern

`src/newtab/layouts/DashboardLayout.tsx` splits the scrollable content area into two branches based on `isSessionView` (defined as any view that is NOT the bookmarks board):

- **Non-session views** (bookmarks): rendered inside `overflow-y-auto px-[6%] pb-6` — centred with generous side padding, scrollable
- **Session/management views** (prompts, sessions, subscriptions, tab-groups, import-export, settings, folder-explorer): rendered inside `overflow-hidden h-full p-[5%]` — full remaining width with uniform 5% inset padding on all sides, no scroll wrapper

**Do not add `px-[6%]` or side-padding to the `isSessionView` branch** — these panels are full-page and provide their own internal layout. Putting them inside the padded scroll container causes the content to be severely squeezed (wastes ~12% of width on each side).

The `p-[5%]` on the session-view wrapper gives uniform breathing room (~5% on each side) from all edges without shrinking the panels themselves.

## Start-Tab Notes

- The start-tab surface manages its own data directly — no background service worker roundtrip for bookmarks/todos/wallpapers
- NewTabSettings stored as `newtab_settings` key in `chrome.storage.local` (NOT merged into the existing `Settings` type)
- Three layout modes: `minimal`, `focus`, `dashboard` — cycled with `Ctrl+Shift+L`
- Feature toggle: when `settings.enabled === false`, start-tab shows a disabled message (redirecting to chrome://newtab/ is blocked by Chrome security)
- Glassmorphism CSS: `.glass` (16px blur), `.glass-panel` (24px blur), `.glass-dark` — defined in `globals.css @layer utilities`
- `BackgroundLayer` renders behind all content (z-index 0); dimming overlay and vignette are separate child divs
- Drag-and-drop: @dnd-kit/sortable with `horizontalListSortingStrategy` for quick links, `verticalListSortingStrategy` for bookmark entries, `rectSortingStrategy` for category grid
- Six widget types: bookmark, clock, note, todo, subscription, tab-groups — rendered by `BookmarkCategoryCard.tsx` dispatching to dedicated body components (`BookmarkCardBody`, `NoteCardBody`, `TodoCardBody`, `SubscriptionCardBody`, `TabGroupsCardBody`)
- Widget sizing: central `WIDGET_CONFIG` registry in `src/core/config/widget-config.ts` defines per-type `minW/minH/maxW/maxH/defaultW/defaultH`; `ResizePopover` enforces constraints; sizes clamped on load for migration safety
- Top nav tabs: Quick Links, Frequently Visited, Tabs, Activity — plus sidebar panels for Sessions, Auto-Saves, Tab Groups, Import/Export, Subscriptions
- Heavy sidebar panels (`SessionsPanel`, `AutoSavesPanel`, `TabGroupsPanel`, `SubscriptionsPanel`) are `React.lazy`-loaded to keep initial bundle small
- `BookmarkBoardContext` provides board-level actions to deep children without prop-drilling; use `useBookmarkBoardActions()` hook inside the provider
- Session management features (SessionBulkToolbar, SessionDiffModal, SettingsPanel, AutoSavesPanel) live in `src/newtab/components/`

## Subscriptions Feature Notes

- Storage: `subscriptions` key in `chrome.storage.local` via `SubscriptionStorage` functions in `src/core/storage/subscription-storage.ts`
- Custom categories: `subscription_categories` key in `chrome.storage.local`
- NOT using IndexedDB, NOT going through background service worker
- Sidepanel view: `'subscriptions'` in `SidePanelView` union, navigated via CreditCard button in Header
- Sidepanel sub-components in `src/sidepanel/components/subscriptions/`: SubscriptionForm, SubscriptionList, SubscriptionRow, SubscriptionCalendar, SubscriptionAnalytics, SubscriptionSummaryStrip, QuickAddTemplates
- Start-tab integration: `SubscriptionCardBody` widget type, `SubscriptionsPanel` sidebar view, `SubscriptionReminder` toast on start-tab load
- Service: `src/core/services/subscription.service.ts` — urgency levels (overdue/today/urgent/soon/safe), monthly normalization, category breakdown, CSV round-trip

## Prompt Manager Feature Notes

- Storage: `prompts`, `prompt_categories`, `prompt_tags`, `prompt_folders` keys in `chrome.storage.local` via functions in `src/core/storage/prompt-storage.ts`; `source` field defaults to `'local'` on migration
- Sidepanel view: `'prompts'` in `SidePanelView` union — `src/sidepanel/views/PromptsView.tsx`
- Sections: Start Page (last 10 used), Quick Access (pinned), All, Favorites, My Prompts (local), App Prompts (app source)
- Variable system: `{{variable}}` syntax, detected via `extractVariables()`, filled via `PromptVariablesModal`
- Navigation: `Ctrl+Shift+P` shortcut + ✨ Sparkles button in Header
- Start-tab widget body: `src/newtab/components/PromptCardBody.tsx` (CardType: `'prompt-manager'`)
- Start-tab panel: `src/newtab/components/PromptsPanel.tsx` (lazy-loaded)
- `SidePanelView` includes `'prompts'`; `CardType` includes `'prompt-manager'`

## Action Limits Feature Notes

- **Plan tiers**: `PlanTier` = `'guest' | 'free' | 'pro' | 'lifetime'`; limits in `PLAN_LIMITS` in `src/core/types/limits.types.ts`
- **Guard+track pattern**: every mutation service calls `await guardAction()` before the operation and `void trackAction()` after; `guardAction` throws `ActionLimitError` when the daily or monthly limit is reached
- **Services with guard+track**: `bookmark.service.ts`, `quicklinks.service.ts`, `todo.service.ts`, `prompt-storage.ts`, `subscription-storage.ts`, `tab-group-template-storage.ts`; also `SAVE_SESSION`, `UPDATE_SESSION`, `DELETE_SESSION` handlers in `event-listeners.ts`
- **Storage keys**: `action_usage` (daily/monthly counts with auto-reset), `cached_plan` (plan tier string) — both in `chrome.storage.local`
- **Plan tier caching**: `auth.service.ts` fetches tier via `get_user_plan_tier()` Supabase RPC on sign-in and resets to `'guest'` on sign-out
- **Remote tracking**: `trackAction()` fire-and-forgets an upsert to `user_action_usage` Supabase table for signed-in users (local counter is source of truth)
- **UI**: `LimitReachedModal` in `src/shared/components/LimitReachedModal.tsx`; limit pill in `Header.tsx` (sidepanel); `LimitStatusRow` in `DashboardSidebar.tsx` (start-tab)
- **Test mocking**: services that call `guardAction`/`trackAction` must mock `@core/services/limits/limit-guard` in their tests: `vi.mock('@core/services/limits/limit-guard', () => ({ guardAction: vi.fn().mockResolvedValue(undefined), trackAction: vi.fn().mockResolvedValue(undefined), ActionLimitError: class ActionLimitError extends Error {} }))`
- **Supabase migrations**: `supabase/migrations/029_action_limits.sql` adds `daily_action_limit`/`monthly_action_limit` to plans + `user_action_usage` table + `upsert_action_usage` and `get_user_plan_tier` RPCs; `030_rename_max_to_lifetime.sql` renames plan; `031_drop_sync_tables.sql` drops old sync tables (run last after all installs migrated)

## Tab Groups Feature Notes

- Storage: `tab_group_templates` key in `chrome.storage.local` via `TabGroupTemplateStorage` static class in `src/core/storage/tab-group-template-storage.ts`
- Types: `TabGroupTemplate` and `TabGroupTemplateTab` in `src/core/types/tab-group.types.ts`
- Live groups queried via `chrome.tabGroups.query({})` + `chrome.tabs.query({})` — available in all extension pages
- Sidepanel view: `'tab-groups'` in `SidePanelView` union — `src/sidepanel/views/TabGroupsView.tsx` with live/saved sections
- Start-tab: `TabGroupsCardBody` widget type, `TabGroupsPanel` sidebar view
- Auto-save: live groups automatically saved as templates when viewed
- `ChromeGroupColor` type from `src/core/types/session.types.ts` (9 colors: grey, blue, red, yellow, green, pink, purple, cyan, orange)

## Testing

- Chrome APIs are mocked globally in `tests/setup.ts`
- Unit tests in `tests/unit/` organized by module (utils, services, storage, contexts, config, components, hooks, stores, background)
  - `tests/unit/utils/` — uuid, date, validators, debounce, favicon, safe-open
  - `tests/unit/services/` — search, export, import, session-count, session.service, subscription.service, prompt.service, bookmark.service, todo.service, quicklinks.service, seed.service, newtab-export.service, weather.service, tab-group.service, migration.service, newtab-settings.service, auth.service
  - `tests/unit/services/limits/` — action-tracker, limit-guard
  - `tests/unit/storage/` — chrome-local-key-adapter, chrome-local-array-repository, newtab-storage, prompt-storage, subscription-storage, tab-group-template-storage, indexeddb, chrome-storage, storage-factory
  - `tests/unit/contexts/` — bookmark-board-context
  - `tests/unit/components/` — ErrorBoundary, Modal, Button, Badge, Toast, ContextMenu, EmptyState
  - `tests/unit/hooks/` — useSession, useAutoSave, useBookmarkDnd, useBookmarkFolderData, useClock, useKeyboard, useKeyboardShortcuts, useMessaging, useNewTabSettings, useSearch, useTheme, useWallpaper
  - `tests/unit/stores/` — sidepanel.store, newtab-ui.store, newtab-data.store
  - `tests/unit/background/` — auto-save-engine, event-listeners, alarms, tab-group-restore
  - `tests/unit/config/` — widget-config
- 661 tests across 64 test files
- Run `npm test` before committing
- Services that call `guardAction`/`trackAction` must mock `@core/services/limits/limit-guard` in their tests (see Action Limits Feature Notes above)

## Do Not

- Do not add `popup` to `action.default_popup` in manifest — Side Panel opens via `openPanelOnActionClick`
- Do not use `chrome.storage.sync` — all data is local only
- Do not import from `@background/` in UI code — communicate via messages only
- Do not modify the `browser-hub` IndexedDB — start-tab data uses the separate `newtab-db` (NewTabDB class)
- Do not merge NewTabSettings into the existing Settings type — it lives under its own storage key
- Do not put subscriptions or tab-group templates in IndexedDB — they use flat `chrome.storage.local` keys

## Email System (web/ and admin/)

- **Transport**: Nodemailer + Resend SMTP (`smtp.resend.com:465`); configured via env vars, no hard-coded credentials
- **Infrastructure** (identical in both apps):
  - `lib/email/transporter.ts` — `getTransporter()` + `getFromAddress()` using `SMTP_*` env vars
  - `lib/email/send.ts` — `sendEmail({ to, subject, html, type, metadata?, sentBy? })` → sends via Nodemailer + logs to `email_log` table; `EmailType` union
  - `lib/email/index.ts` — barrel export of all builders + `sendEmail`
  - `lib/email/templates/base.ts` — `wrapInBaseLayout()`, `button()`, `heading()`, `paragraph()`, `smallText()`, `divider()`; logo from `SMTP_LOGO_URL` env var, falls back to "Browser Hub" text
- **Templates (web — 9)**: `emailVerification`, `welcome`, `passwordReset`, `passwordResetConfirmation`, `supportTicket`, `featureSuggestion`, `billingNotification`, `invoiceReceipt`, `trialEnding`
- **Templates (admin — 11)**: all 9 web templates + `ticketReply`, `suggestionReply`
- **Email log**: `email_log` table in Supabase (migration 009 + enhanced by migration 018 with `type`, `message_id`, `metadata`, `sent_by` columns); all sends (success and failure) are logged
- **Auth emails** (web) — bypass Supabase's built-in email; use `serviceSupabase.auth.admin.generateLink()` to get token, build URL, then call `sendEmail()`:
  - `api/auth/sign-up` — verification email (fire-and-forget after signUp)
  - `api/auth/forgot-password` — password reset email (always returns success)
  - `api/auth/resend-verification` — re-sends verification link
  - `api/auth/password-changed` — POST (authenticated) sends confirmation email
- **Notification emails** (web):
  - `api/support` — POST: inserts ticket to `tickets` table + fires `supportTicket` email to `SMTP_SUPPORT_EMAIL`
  - `api/suggestions` — POST: inserts suggestion to `suggestions` table + fires `featureSuggestion` email to `SMTP_FROM_EMAIL`
  - Support and Suggestions pages call these routes (not direct Supabase client inserts)
- **Admin email API routes**:
  - `api/emails/send` — POST: sends real email via SMTP (used by admin Emails page Send tab)
  - `api/tickets/[id]/reply` — POST: inserts reply + sends `ticketReply` email to ticket owner
  - `api/suggestions/[id]/reply` — POST: updates suggestion + sends `suggestionReply` email to submitter
- **Admin Emails page**: Send tab uses `EmailSendForm` client component (`app/(admin)/emails/EmailSendForm.tsx`) that calls `api/emails/send`; Logs tab reads from `email_log`
- **Required env vars** (both `web/.env.local` and `admin/.env.local`):
  ```
  SMTP_HOST=smtp.resend.com
  SMTP_PORT=465
  SMTP_USER=resend
  SMTP_PASS=<resend-api-key>
  SMTP_FROM_NAME=Browser Hub
  SMTP_FROM_EMAIL=info@yourdomain.com
  SMTP_SUPPORT_EMAIL=support@yourdomain.com
  SMTP_LOGO_URL=https://yourdomain.com/logo.png   # optional
  ```

## Web App (`web/`)

- **Stack**: Next.js 16 (canary), React 19, Tailwind CSS v4, shadcn/ui, Lucide, Supabase SSR
- **Port**: 3000
- **Route groups**: `(public)` for landing/login/register, `(authenticated)` for user pages
- **Sidebar**: shadcn `SidebarProvider` + `SidebarLockProvider` with 3 modes (expanded/collapsed/hover)
- **Theme**: Cookie-based light/dark/system with FOUC prevention via inline `<script>`
- **Auth**: Supabase SSR client, middleware redirects unauthenticated users to `/login`
- **Pages**: Dashboard (daily/monthly action usage bars via `get_user_plan_tier` + `user_action_usage` table), Billing (plan comparison with action limits + Checkout), Settings (Profile/Appearance/Security tabs), Support, Suggestions
- **Auth pages**: Login (email/password + Google OAuth), Register (with password strength), Forgot Password, Reset Password, Verify Email
- **API routes**: `api/auth/sign-in`, `api/auth/sign-up`, `api/auth/forgot-password`, `api/auth/resend-verification`, `api/auth/password-changed`, `api/auth/google`, `api/auth/session`, `api/support`, `api/suggestions`, `api/billing/upgrade`
- **Auth callbacks**: `auth/callback` (OAuth), `auth/confirm` (email verification)
- **Env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (required — used in auth redirect URLs and email links), `SMTP_*` (see Email System above)
- **Design tokens**: CSS custom properties (`--dark`, `--dark-card`, `--dark-border`, `--dark-elevated`, `--dark-hover`)
- **UI components**: 19 shadcn components in `web/components/ui/`

## Admin App (`admin/`)

- **Stack**: Next.js 16 (canary), React 19, Tailwind CSS v4, shadcn/ui, Lucide, Supabase SSR
- **Port**: 3001
- **Route groups**: `(admin)` for all authenticated admin pages, `/login` for admin login
- **Sidebar**: Custom `AdminSidebar` with CSS transition-based collapse, 10 nav items
- **Theme**: Same cookie-based system as web app
- **Auth**: Admin role check via Supabase `profiles.role` column; uses service-role client (`createServiceClient`) for privileged queries
- **Pages**: Overview (stats via `get_admin_overview` RPC — includes `total_tab_groups` since migration 014), Users, Statistics, Promo Codes, Subscriptions, Webhooks, Tickets, Suggestions, Quotas, Emails
- **Admin API routes**: `api/auth/sign-in`, `api/auth/sign-out`, `api/emails/send`, `api/tickets/[id]/reply`, `api/suggestions/[id]/reply`
- **UI components**: 18 shadcn components in `admin/components/ui/`
- **Metadata**: `robots: noindex, nofollow` (not indexed by search engines)
- **Env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*` (see `admin/.env.local.example`)
