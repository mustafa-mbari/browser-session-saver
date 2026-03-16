# CLAUDE.md — Session Saver Project Guide

## Project Overview

Session Saver is a Chrome extension (Manifest V3) that saves, restores, and manages browser sessions. It includes a Chrome Side Panel (primary UI), Start-Tab with glassmorphism UI, a full-page Dashboard, a Popup for quick actions, and a content script for scroll position capture — all built with React 18 + TypeScript + Tailwind CSS.

## Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # Production build → dist/
npm test         # Vitest unit tests
npm run lint     # ESLint
npm run format   # Prettier
```

## Architecture

- **Background service worker** (`src/background/`) — all Chrome API calls, auto-save engine, message handling
- **Core layer** (`src/core/`) — framework-agnostic types, services, storage, utilities
- **UI surfaces** — Side Panel (`src/sidepanel/`), Popup (`src/popup/`), Dashboard (`src/dashboard/`), Start-Tab (`src/newtab/`)
- **Content script** (`src/content/`) — scroll position capture via `CAPTURE_SCROLL` message listener
- **Shared** (`src/shared/`) — reusable components, hooks, styles, i18n utilities used by all UI surfaces

## Key Conventions

- **Path aliases**: `@core/*`, `@shared/*`, `@background/*`, `@sidepanel/*`, `@popup/*`, `@dashboard/*`, `@newtab/*`
- **State management**: Zustand stores per UI surface (sidepanel.store.ts, dashboard.store.ts, newtab.store.ts)
- **Storage**: chrome.storage.local for settings, IndexedDB for sessions — abstracted via `IStorage` interface; start-tab uses a separate `newtab-db` (NewTabDB class in `src/core/storage/newtab-storage.ts`) for bookmarks/todos/wallpapers
- **Messaging**: Typed discriminated union `Message` type between service worker and UI via `chrome.runtime.sendMessage`; 15 action types defined in `messages.types.ts`
- **Styling**: Tailwind CSS with CSS custom properties for theme tokens, dark mode via `class` strategy. Glassmorphism utilities (`.glass`, `.glass-panel`, `.glass-dark`, `.glass-hover`, `.vignette`) defined in `@layer utilities` in `globals.css`
- **Components**: All shared components support dark mode and include ARIA attributes
- **Tests**: Vitest with jsdom, Chrome API mocked in `tests/setup.ts`; 186 tests across 18 files in `tests/unit/`
- **i18n**: `_locales/en/messages.json` (~282 keys), `_locales/ar/messages.json`, `_locales/de/messages.json`; `t()` wrapper at `src/shared/utils/i18n.ts`
- **Virtual scrolling**: `@tanstack/react-virtual` v3 used in `SessionsPanel` (3-column `lanes` grid) and `AutoSavesPanel` (flat list with headers); threshold ≤30 items uses plain DOM, >30 uses virtualizer
- **Error boundaries**: `src/shared/components/ErrorBoundary.tsx` wraps all major UI sections; reports via `errorBoundaryTitle/Desc/Reload` i18n keys
- **Generic storage adapter**: `src/core/storage/chrome-local-key-adapter.ts` — `ChromeLocalKeyAdapter<T>` shared by `SubscriptionStorage` and `TabGroupTemplateStorage`
- **Shared color constants**: `src/core/constants/tab-group-colors.ts` — `GROUP_COLORS` map imported by `SessionsPanel` and start-tab components
- **ContextMenu accessibility**: keyboard navigation (Enter/Space to open, Escape, ArrowUp/Down, Home/End, Tab to close); roving tabindex pattern; `requestAnimationFrame` deferred focus
- **Widget config**: `src/core/config/widget-config.ts` — `WIDGET_CONFIG` registry with per-type min/max/default sizes, `getDefaultSize()`, `clampSize()` utilities
- **View unions**:
  - `SidePanelView`: `'home' | 'session-detail' | 'tab-groups' | 'settings' | 'import-export' | 'subscriptions'`
  - `DashboardPage`: `'sessions' | 'auto-saves' | 'tab-groups' | 'import-export' | 'settings'`
  - `CardType`: `'bookmark' | 'clock' | 'note' | 'todo' | 'subscription' | 'tab-groups'`

## Important Files

- `public/manifest.json` — Chrome Manifest V3 with permissions (`tabs`, `tabGroups`, `storage`, `alarms`, `idle`, `sidePanel`, `activeTab`, `topSites`, `bookmarks`), `optional_permissions: [history]`, side_panel, and `chrome_url_overrides.newtab`
- `src/core/types/session.types.ts` — Core data model (Session, Tab, TabGroup, AutoSaveTrigger, ChromeGroupColor)
- `src/core/types/newtab.types.ts` — Start-tab data models: Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoItem, TodoList, NewTabSettings, CardType, GRADIENT_PRESETS
- `src/core/types/messages.types.ts` — Message protocol between SW and UI (15 action types)
- `src/core/types/subscription.types.ts` — Subscription, SubscriptionTemplate, BillingCycle, DueUrgency, SUPPORTED_CURRENCIES, SUBSCRIPTION_TEMPLATES (22 presets)
- `src/core/types/tab-group.types.ts` — TabGroupTemplate, TabGroupTemplateTab
- `src/core/config/widget-config.ts` — Widget sizing configuration registry: `WidgetSizeConfig` interface, `WIDGET_CONFIG` (per-CardType min/max/default), `getDefaultSize()`, `clampSize()`
- `src/core/storage/newtab-storage.ts` — Multi-store IndexedDB adapter (newtab-db v1); stores: quickLinks, boards, bookmarkCategories, bookmarkEntries, todoLists, todoItems, wallpaperImages
- `src/core/storage/chrome-local-key-adapter.ts` — Generic `ChromeLocalKeyAdapter<T>` for storing arrays under a single key; used by subscription and tab-group-template storage
- `src/core/storage/subscription-storage.ts` — Flat chrome.storage.local adapter; keys: `subscriptions` (Subscription[]), `subscription_categories` (CustomCategory[])
- `src/core/storage/tab-group-template-storage.ts` — Static class adapter; key: `tab_group_templates` in chrome.storage.local
- `src/core/constants/tab-group-colors.ts` — `GROUP_COLORS` map (ChromeGroupColor → CSS hex); imported by session and start-tab components
- `src/core/services/subscription.service.ts` — Urgency calculation, monthly normalization, analytics, CSV import/export, currency formatting
- `src/background/event-listeners.ts` — Central message dispatcher (15 handlers)
- `src/background/auto-save-engine.ts` — Auto-save trigger management; calls `upsertAutoSaveSession` so each trigger type maintains exactly one pinned entry (updated in place)
- `src/content/scroll-capture.ts` — Content script listening for `CAPTURE_SCROLL` messages, returns `{x, y}` scroll position
- `src/sidepanel/views/HomeView.tsx` — Primary user-facing view with sessions, current tabs, and tab groups tabs
- `src/sidepanel/views/SubscriptionsView.tsx` — Subscription management with List/Calendar/Analytics tabs
- `src/sidepanel/views/TabGroupsView.tsx` — Live and saved tab groups management
- `src/dashboard/App.tsx` — Dashboard root with 5 pages and sidebar navigation
- `src/dashboard/stores/dashboard.store.ts` — Dashboard Zustand store with `DashboardPage` union type
- `src/newtab/App.tsx` — Start-tab root component: data loading, layout selection, overlay management
- `src/newtab/stores/newtab.store.ts` — Single Zustand store for all start-tab state (settings, boards, categories, entries, quickLinks, todoLists, todoItems, UI flags)
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

## Subscriptions Feature Notes

- Storage: `subscriptions` key in `chrome.storage.local` via `SubscriptionStorage` functions in `src/core/storage/subscription-storage.ts`
- Custom categories: `subscription_categories` key in `chrome.storage.local`
- NOT using IndexedDB, NOT going through background service worker
- Sidepanel view: `'subscriptions'` in `SidePanelView` union, navigated via CreditCard button in Header
- Sidepanel sub-components in `src/sidepanel/components/subscriptions/`: SubscriptionForm, SubscriptionList, SubscriptionRow, SubscriptionCalendar, SubscriptionAnalytics, SubscriptionSummaryStrip, QuickAddTemplates
- Start-tab integration: `SubscriptionCardBody` widget type, `SubscriptionsPanel` sidebar view, `SubscriptionReminder` toast on start-tab load
- Service: `src/core/services/subscription.service.ts` — urgency levels (overdue/today/urgent/soon/safe), monthly normalization, category breakdown, CSV round-trip

## Tab Groups Feature Notes

- Storage: `tab_group_templates` key in `chrome.storage.local` via `TabGroupTemplateStorage` static class in `src/core/storage/tab-group-template-storage.ts`
- Types: `TabGroupTemplate` and `TabGroupTemplateTab` in `src/core/types/tab-group.types.ts`
- Live groups queried via `chrome.tabGroups.query({})` + `chrome.tabs.query({})` — available in all extension pages
- Sidepanel view: `'tab-groups'` in `SidePanelView` union — `src/sidepanel/views/TabGroupsView.tsx` with live/saved sections
- Dashboard page: `'tab-groups'` in `DashboardPage` — `src/dashboard/pages/TabGroupsPage.tsx`
- Start-tab: `TabGroupsCardBody` widget type, `TabGroupsPanel` sidebar view
- Auto-save: live groups automatically saved as templates when viewed
- `ChromeGroupColor` type from `src/core/types/session.types.ts` (9 colors: grey, blue, red, yellow, green, pink, purple, cyan, orange)

## Dashboard Notes

- 5 pages: Sessions, Auto-Saves, Tab Groups, Import/Export, Settings
- Zustand store: `src/dashboard/stores/dashboard.store.ts` with `DashboardPage` type
- Sidebar navigation: `src/dashboard/components/Sidebar.tsx`
- Sessions page features: StatsWidget, search with debounce, session list with checkboxes, session detail panel, bulk toolbar (merge/export/delete), diff modal for session comparison
- Full-page management UI at `src/dashboard/index.html`

## Testing

- Chrome APIs are mocked globally in `tests/setup.ts`
- Unit tests in `tests/unit/` organized by module (utils, services, storage, contexts, config)
  - `tests/unit/utils/` — uuid, date, validators, debounce
  - `tests/unit/services/` — search, export, import, session-count, session.service, subscription.service
  - `tests/unit/storage/` — chrome-local-key-adapter, newtab-storage
  - `tests/unit/contexts/` — bookmark-board-context
  - `tests/unit/components/` — ErrorBoundary, Modal
  - `tests/unit/background/` — auto-save-engine, event-listeners
  - `tests/unit/config/` — widget-config
- 186 tests across 18 test files
- Run `npm test` before committing

## Do Not

- Do not add `popup` to `action.default_popup` in manifest — Side Panel opens via `openPanelOnActionClick`
- Do not use `chrome.storage.sync` — all data is local only
- Do not import from `@background/` in UI code — communicate via messages only
- Do not import from `@background/` in content script — it only listens for `CAPTURE_SCROLL`
- Do not modify the `session-saver` IndexedDB — start-tab data uses the separate `newtab-db` (NewTabDB class)
- Do not merge NewTabSettings into the existing Settings type — it lives under its own storage key
- Do not put subscriptions or tab-group templates in IndexedDB — they use flat `chrome.storage.local` keys
