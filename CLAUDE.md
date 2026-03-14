# CLAUDE.md — Session Saver Project Guide

## Project Overview

Session Saver is a Chrome extension (Manifest V3) that saves, restores, and manages browser sessions. The primary UI is a Chrome Side Panel built with React 18 + TypeScript + Tailwind CSS.

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
- **UI surfaces** — Side Panel (`src/sidepanel/`), Popup (`src/popup/`), Dashboard (`src/dashboard/`)
- **Shared** (`src/shared/`) — reusable components, hooks, styles used by all UI surfaces

## Key Conventions

- **Path aliases**: `@core/*`, `@shared/*`, `@background/*`, `@sidepanel/*`, `@popup/*`, `@dashboard/*`
- **State management**: Zustand stores per UI surface (sidepanel.store.ts, dashboard.store.ts)
- **Storage**: chrome.storage.local for settings, IndexedDB for sessions — abstracted via `IStorage` interface
- **Messaging**: Typed discriminated union `Message` type between service worker and UI via `chrome.runtime.sendMessage`
- **Styling**: Tailwind CSS with CSS custom properties for theme tokens, dark mode via `class` strategy
- **Components**: All shared components support dark mode and include ARIA attributes
- **Tests**: Vitest with jsdom, Chrome API mocked in `tests/setup.ts`

## Important Files

- `public/manifest.json` — Chrome Manifest V3 with permissions and side_panel config
- `src/core/types/session.types.ts` — Core data model (Session, Tab, TabGroup)
- `src/core/types/messages.types.ts` — Message protocol between SW and UI
- `src/background/event-listeners.ts` — Central message dispatcher
- `src/background/auto-save-engine.ts` — Auto-save trigger management; calls `upsertAutoSaveSession` so each trigger type maintains exactly one pinned entry (updated in place)
- `src/sidepanel/views/HomeView.tsx` — Primary user-facing view

## Testing

- Chrome APIs are mocked globally in `tests/setup.ts`
- Unit tests in `tests/unit/` organized by module (utils, services)
- Run `npm test` before committing

## Do Not

- Do not add `popup` to `action.default_popup` in manifest — Side Panel opens via `openPanelOnActionClick`
- Do not use `chrome.storage.sync` — all data is local only
- Do not import from `@background/` in UI code — communicate via messages only
