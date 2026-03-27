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

## Key Conventions

- **Path aliases**: `@core/*`, `@shared/*`, `@background/*`, `@sidepanel/*`, `@popup/*`, `@newtab/*`
- **State management**: Zustand stores per UI surface (sidepanel.store.ts; newtab split into newtab-ui.store.ts + newtab-data.store.ts with facade re-export from newtab.store.ts)
- **Storage**: chrome.storage.local for settings, IndexedDB (`browser-hub` v2 with `isAutoSave`/`createdAt` indexes) for sessions — abstracted via `IStorage` interface (with optional `getByIndex` for indexed queries); start-tab uses a separate `newtab-db` (NewTabDB class in `src/core/storage/newtab-storage.ts`) for bookmarks/todos/wallpapers
- **Messaging**: Typed discriminated union `Message` type between service worker and UI via `chrome.runtime.sendMessage`; 19 action types defined in `messages.types.ts`
- **Styling**: Tailwind CSS with CSS custom properties for theme tokens, dark mode via `class` strategy. Glassmorphism utilities (`.glass`, `.glass-panel`, `.glass-dark`, `.glass-hover`, `.vignette`) defined in `@layer utilities` in `globals.css`
- **Components**: All shared components support dark mode and include ARIA attributes
- **Tests**: Vitest with jsdom, Chrome API mocked in `tests/setup.ts`; 256 tests across 21 files in `tests/unit/`
- **i18n**: `_locales/en/messages.json` (~282 keys), `_locales/ar/messages.json`, `_locales/de/messages.json`; `t()` wrapper at `src/shared/utils/i18n.ts`
- **Virtual scrolling**: `@tanstack/react-virtual` v3 used in `SessionsPanel` (3-column `lanes` grid) and `AutoSavesPanel` (flat list with headers); threshold ≤30 items uses plain DOM, >30 uses virtualizer
- **Error boundaries**: `src/shared/components/ErrorBoundary.tsx` wraps all major UI sections; reports via `errorBoundaryTitle/Desc/Reload` i18n keys
- **Generic storage adapter**: `src/core/storage/chrome-local-key-adapter.ts` — `ChromeLocalKeyAdapter<T>` shared by `SubscriptionStorage` and `TabGroupTemplateStorage`
- **Shared color constants**: `src/core/constants/tab-group-colors.ts` — `GROUP_COLORS` map imported by `SessionsPanel` and start-tab components
- **ContextMenu accessibility**: keyboard navigation (Enter/Space to open, Escape, ArrowUp/Down, Home/End, Tab to close); roving tabindex pattern; `requestAnimationFrame` deferred focus
- **Widget config**: `src/core/config/widget-config.ts` — `WIDGET_CONFIG` registry with per-type min/max/default sizes, `getDefaultSize()`, `clampSize()` utilities
- **View unions**:
  - `SidePanelView`: `'home' | 'session-detail' | 'tab-groups' | 'settings' | 'import-export' | 'subscriptions' | 'prompts' | 'cloud-sync'`
  - `CardType`: `'bookmark' | 'clock' | 'note' | 'todo' | 'subscription' | 'tab-groups' | 'prompt-manager'`
- **Cloud sync**: `@supabase/supabase-js` with custom `chrome.storage.local` auth adapter; no `@supabase/ssr` (no cookies in extensions). Env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` injected at build time; placeholder fallbacks prevent test-time throws.

## Important Files

- `public/manifest.json` — Chrome Manifest V3 with permissions (`tabs`, `tabGroups`, `storage`, `alarms`, `idle`, `sidePanel`, `activeTab`, `topSites`, `bookmarks`), `optional_permissions: [history]`, `host_permissions: ["https://*.supabase.co/*"]`, side_panel, and `chrome_url_overrides.newtab`
- `src/core/types/session.types.ts` — Core data model (Session, Tab, TabGroup, AutoSaveTrigger, ChromeGroupColor)
- `src/core/types/newtab.types.ts` — Start-tab data models: Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoItem, TodoList, NewTabSettings, CardType, GRADIENT_PRESETS
- `src/core/types/messages.types.ts` — Message protocol between SW and UI (19 action types)
- `src/core/types/prompt.types.ts` — Prompt, PromptFolder, PromptCategory, PromptTag, PromptSectionKey, PromptFilterOptions, PromptSortField
- `src/core/supabase/client.ts` — Singleton Supabase client using `chrome.storage.local` as auth storage adapter
- `src/core/services/sync-auth.service.ts` — Supabase auth wrapper: `syncSignIn`, `syncSignOut`, `getSyncSession`, `getSyncUserId`, `isSyncAuthenticated`
- `src/core/services/sync.service.ts` — Cloud sync orchestrator: `syncAll`, `pushSession`, `deleteRemoteSession`, `getSyncStatus`, `getUserQuota`; camelCase↔snake_case mappers; quota-aware (sessions/prompts/subs); status persisted to `cloud_sync_status` key
- `src/core/types/subscription.types.ts` — Subscription, SubscriptionTemplate, BillingCycle, DueUrgency, SUPPORTED_CURRENCIES, SUBSCRIPTION_TEMPLATES (22 presets)
- `src/core/types/tab-group.types.ts` — TabGroupTemplate, TabGroupTemplateTab
- `src/core/config/widget-config.ts` — Widget sizing configuration registry: `WidgetSizeConfig` interface, `WIDGET_CONFIG` (per-CardType min/max/default), `getDefaultSize()`, `clampSize()`
- `src/core/storage/indexeddb.ts` — IndexedDB adapter (`browser-hub` v2); native `getAll()`/`getAllKeys()`, secondary indexes (`isAutoSave`, `createdAt`), `getByIndex()` for filtered queries
- `src/core/storage/newtab-storage.ts` — Multi-store IndexedDB adapter (newtab-db v1); stores: quickLinks, boards, bookmarkCategories, bookmarkEntries, todoLists, todoItems, wallpaperImages
- `src/core/storage/chrome-local-key-adapter.ts` — Generic `ChromeLocalKeyAdapter<T>` for storing arrays under a single key; used by subscription and tab-group-template storage
- `src/core/storage/subscription-storage.ts` — Flat chrome.storage.local adapter; keys: `subscriptions` (Subscription[]), `subscription_categories` (CustomCategory[])
- `src/core/storage/tab-group-template-storage.ts` — Static class adapter; key: `tab_group_templates` in chrome.storage.local
- `src/core/constants/tab-group-colors.ts` — `GROUP_COLORS` map (ChromeGroupColor → CSS hex); imported by session and start-tab components
- `src/core/services/subscription.service.ts` — Urgency calculation, monthly normalization, analytics, CSV import/export, currency formatting
- `src/core/storage/prompt-storage.ts` — chrome.storage.local adapter; keys: `prompts`, `prompt_categories`, `prompt_tags`, `prompt_folders`; includes `source` field migration
- `src/core/services/prompt.service.ts` — `extractVariables`, `applyVariables`, `filterPrompts`, `filterBySection`, `buildFolderTree`, `sortPrompts`, `getRecentPrompts`, `getPinnedPrompts`
- `src/background/event-listeners.ts` — Central message dispatcher (19 handlers); after session save/update: calls `syncAfterMutation` (fire-and-forget); after delete: calls `deleteRemoteSession`
- `src/background/auto-save-engine.ts` — Auto-save trigger management; calls `upsertAutoSaveSession` so each trigger type maintains exactly one pinned entry (updated in place)
- `src/sidepanel/views/HomeView.tsx` — Slim orchestrator (~250 LOC) for sessions, current tabs, and tab groups tabs
- `src/sidepanel/components/CurrentTabsPanel.tsx` — Current browser tabs panel (extracted from HomeView)
- `src/sidepanel/components/HomeTabGroupsPanel.tsx` — Tab groups panel with live/saved sections (extracted from HomeView)
- `src/sidepanel/components/HomeLiveGroupRow.tsx` — Live tab group row with inline edit, expand, actions (extracted from HomeView)
- `src/sidepanel/components/HomeSavedGroupRow.tsx` — Saved tab group template row with restore/rename/delete (extracted from HomeView)
- `src/sidepanel/views/SubscriptionsView.tsx` — Subscription management with List/Calendar/Analytics tabs
- `src/sidepanel/views/TabGroupsView.tsx` — Live and saved tab groups management
- `src/sidepanel/views/PromptsView.tsx` — Two-pane prompt manager: left=PromptSectionNav (sections + nested folder tree), right=PromptList or StartPageContent
- `src/sidepanel/views/CloudSyncView.tsx` — Sign-in form (not authenticated) or quota bars + Sync Now button (authenticated); uses `SYNC_*` messages to background SW
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

## Cloud Sync Feature Notes

- Package: `@supabase/supabase-js` (NOT `@supabase/ssr` — no cookies in Chrome extensions)
- Auth storage: custom adapter wrapping `chrome.storage.local` in `src/core/supabase/client.ts`
- Env vars: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in root `.env`; placeholder fallbacks prevent test-time module throws
- Sync strategy: push-first "full snapshot" — reads ALL local data and upserts to Supabase on each cycle, up to quota limits
- Triggers: 15-minute `chrome.alarms` alarm (`cloud-sync`) + fire-and-forget after each session save/update/delete
- Alarm registered synchronously in `src/background/index.ts` (MV3 requirement — before any `await`)
- Tables: `sessions`, `prompts`, `prompt_folders`, `tracked_subscriptions`; quota via `get_user_quota(p_user_id)` RPC (cached 5 min)
- `SyncStatus` and `UserQuota` types in `src/core/services/sync.service.ts`
- Status persisted to `cloud_sync_status` key in `chrome.storage.local`
- Sidepanel view: `'cloud-sync'` in `SidePanelView` union — Cloud icon button in Header
- Test mocking: `vi.mock('@core/services/sync-auth.service', ...)` and `vi.mock('@core/services/sync.service', ...)` added to `event-listeners.test.ts` to prevent real API calls
- Supabase migrations: `supabase/migrations/` contains 11 SQL files (001–011) covering auth/profiles, plans, user_plans, promo_codes, sessions, prompts, tracked_subscriptions, bookmark_folders, admin_tables, triggers, quota_functions

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
- Unit tests in `tests/unit/` organized by module (utils, services, storage, contexts, config)
  - `tests/unit/utils/` — uuid, date, validators, debounce
  - `tests/unit/services/` — search, export, import, session-count, session.service, subscription.service, prompt.service
  - `tests/unit/storage/` — chrome-local-key-adapter, newtab-storage, prompt-storage
  - `tests/unit/contexts/` — bookmark-board-context
  - `tests/unit/components/` — ErrorBoundary, Modal
  - `tests/unit/background/` — auto-save-engine, event-listeners
  - `tests/unit/config/` — widget-config
- 256 tests across 21 test files
- Run `npm test` before committing
- Sync services must be mocked in `event-listeners.test.ts` to prevent real Supabase calls: `vi.mock('@core/services/sync-auth.service', ...)` + `vi.mock('@core/services/sync.service', ...)`

## Do Not

- Do not add `popup` to `action.default_popup` in manifest — Side Panel opens via `openPanelOnActionClick`
- Do not use `chrome.storage.sync` — all data is local only
- Do not import from `@background/` in UI code — communicate via messages only
- Do not modify the `browser-hub` IndexedDB — start-tab data uses the separate `newtab-db` (NewTabDB class)
- Do not merge NewTabSettings into the existing Settings type — it lives under its own storage key
- Do not put subscriptions or tab-group templates in IndexedDB — they use flat `chrome.storage.local` keys

## Web App (`web/`)

- **Stack**: Next.js 16 (canary), React 19, Tailwind CSS v4, shadcn/ui, Lucide, Supabase SSR
- **Port**: 3000
- **Route groups**: `(public)` for landing/login/register, `(authenticated)` for user pages
- **Sidebar**: shadcn `SidebarProvider` + `SidebarLockProvider` with 3 modes (expanded/collapsed/hover)
- **Theme**: Cookie-based light/dark/system with FOUC prevention via inline `<script>`
- **Auth**: Supabase SSR client, middleware redirects unauthenticated users to `/login`
- **Pages**: Dashboard, Billing, Settings (Profile/Appearance/Security tabs), Support, Suggestions
- **Auth pages**: Login (email/password + Google OAuth), Register (with password strength), Forgot Password, Verify Email
- **API routes**: `api/auth/sign-in`, `api/auth/sign-up`, `api/auth/forgot-password`, `api/auth/google`, `api/auth/session`
- **Auth callbacks**: `auth/callback` (OAuth), `auth/confirm` (email verification)
- **Design tokens**: CSS custom properties (`--dark`, `--dark-card`, `--dark-border`, `--dark-elevated`, `--dark-hover`)
- **UI components**: 19 shadcn components in `web/components/ui/`

## Admin App (`admin/`)

- **Stack**: Next.js 16 (canary), React 19, Tailwind CSS v4, shadcn/ui, Lucide, Supabase SSR
- **Port**: 3001
- **Route groups**: `(admin)` for all authenticated admin pages, `/login` for admin login
- **Sidebar**: Custom `AdminSidebar` with CSS transition-based collapse, 10 nav items
- **Theme**: Same cookie-based system as web app
- **Auth**: Admin role check via Supabase `profiles.role` column; uses service-role client (`createServiceClient`) for privileged queries
- **Pages**: Overview, Users, Statistics, Promo Codes, Subscriptions, Webhooks, Tickets, Suggestions, Quotas, Emails
- **UI components**: 18 shadcn components in `admin/components/ui/`
- **Metadata**: `robots: noindex, nofollow` (not indexed by search engines)
