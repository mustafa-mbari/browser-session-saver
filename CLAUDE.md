# CLAUDE.md — Session Saver Project Guide

## Project Overview

Session Saver is a Chrome extension (Manifest V3) that saves, restores, and manages browser sessions. The primary UI is a Chrome Side Panel built with React 18 + TypeScript + Tailwind CSS. It also includes a New Tab Page Override with glassmorphism UI, bookmark management, to-do, and session widgets.

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
- **UI surfaces** — Side Panel (`src/sidepanel/`), Popup (`src/popup/`), Dashboard (`src/dashboard/`), New Tab (`src/newtab/`)
- **Shared** (`src/shared/`) — reusable components, hooks, styles used by all UI surfaces

## Key Conventions

- **Path aliases**: `@core/*`, `@shared/*`, `@background/*`, `@sidepanel/*`, `@popup/*`, `@dashboard/*`, `@newtab/*`
- **State management**: Zustand stores per UI surface (sidepanel.store.ts, dashboard.store.ts, newtab.store.ts)
- **Storage**: chrome.storage.local for settings, IndexedDB for sessions — abstracted via `IStorage` interface; newtab uses a separate `newtab-db` (NewTabDB class in `src/core/storage/newtab-storage.ts`) for bookmarks/todos/wallpapers
- **Messaging**: Typed discriminated union `Message` type between service worker and UI via `chrome.runtime.sendMessage`
- **Styling**: Tailwind CSS with CSS custom properties for theme tokens, dark mode via `class` strategy. Glassmorphism utilities (`.glass`, `.glass-panel`, `.glass-dark`, `.glass-hover`, `.vignette`) defined in `@layer utilities` in `globals.css`
- **Components**: All shared components support dark mode and include ARIA attributes
- **Tests**: Vitest with jsdom, Chrome API mocked in `tests/setup.ts`

## Important Files

- `public/manifest.json` — Chrome Manifest V3 with permissions, side_panel, and `chrome_url_overrides.newtab`; includes `topSites`, `bookmarks`, `optional_permissions: [history]`, `host_permissions: [chrome://favicon/*]`
- `src/core/types/session.types.ts` — Core data model (Session, Tab, TabGroup)
- `src/core/types/newtab.types.ts` — New tab data models: Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoItem, TodoList, NewTabSettings, GRADIENT_PRESETS
- `src/core/types/messages.types.ts` — Message protocol between SW and UI
- `src/core/storage/newtab-storage.ts` — Multi-store IndexedDB adapter (newtab-db v1); stores: quickLinks, boards, bookmarkCategories, bookmarkEntries, todoLists, todoItems, wallpaperImages
- `src/background/event-listeners.ts` — Central message dispatcher
- `src/background/auto-save-engine.ts` — Auto-save trigger management; calls `upsertAutoSaveSession` so each trigger type maintains exactly one pinned entry (updated in place)
- `src/sidepanel/views/HomeView.tsx` — Primary user-facing view
- `src/newtab/App.tsx` — New Tab root component: data loading, layout selection, overlay management
- `src/newtab/stores/newtab.store.ts` — Single Zustand store for all newtab state (settings, boards, categories, entries, quickLinks, todoLists, todoItems, UI flags)
- `src/newtab/hooks/useNewTabSettings.ts` — Settings load/sync hook (reads `newtab_settings` key from chrome.storage.local)
- `src/core/services/newtab-settings.service.ts` — Read/write NewTabSettings via `getSettingsStorage()`

## New Tab Page Notes

- The newtab surface manages its own data directly — no background service worker roundtrip for bookmarks/todos/wallpapers
- NewTabSettings stored as `newtab_settings` key in `chrome.storage.local` (NOT merged into the existing `Settings` type)
- Three layout modes: `minimal`, `focus`, `dashboard` — cycled with `Ctrl+Shift+L`
- Feature toggle: when `settings.enabled === false`, newtab shows a disabled message (redirecting to chrome://newtab/ is blocked by Chrome security)
- Glassmorphism CSS: `.glass` (16px blur), `.glass-panel` (24px blur), `.glass-dark` — defined in `globals.css @layer utilities`
- `BackgroundLayer` renders behind all content (z-index 0); dimming overlay and vignette are separate child divs
- Drag-and-drop: @dnd-kit/sortable with `horizontalListSortingStrategy` for quick links, `verticalListSortingStrategy` for bookmark entries, `rectSortingStrategy` for category grid

## Testing

- Chrome APIs are mocked globally in `tests/setup.ts`
- Unit tests in `tests/unit/` organized by module (utils, services)
- Run `npm test` before committing

## Do Not

- Do not add `popup` to `action.default_popup` in manifest — Side Panel opens via `openPanelOnActionClick`
- Do not use `chrome.storage.sync` — all data is local only
- Do not import from `@background/` in UI code — communicate via messages only
- Do not modify the `session-saver` IndexedDB — newtab data uses the separate `newtab-db` (NewTabDB class)
- Do not merge NewTabSettings into the existing Settings type — it lives under its own storage key
