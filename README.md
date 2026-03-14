# Session Saver — Chrome Extension

Save, restore, and manage your browser sessions with one click. Auto-save protects your tabs before shutdown, sleep, or low battery.

## Features

- **One-Click Save** — Save all tabs from the current window instantly
- **Auto-Save Engine** — Automatically saves before browser close, system sleep, low battery, periodic timer, and window close; one pinned entry per trigger type, updated in place instead of accumulating
- **Tab Group Support** — Full-fidelity save/restore of Chrome tab groups with colors, names, and collapsed state
- **Side Panel UI** — Primary interface docked to the browser for always-accessible session management
- **Search & Filter** — Full-text search across session names, tags, URLs, and titles
- **Import/Export** — Export as JSON, HTML bookmarks, Markdown, CSV, or plain text; import from JSON, HTML, or URL lists
- **Dark Mode** — Light/dark/system theme support
- **Dashboard** — Full-page management with bulk operations, stats, and advanced settings
- **Virtual Scrolling** — Handles 500+ sessions with smooth performance
- **i18n** — English and Arabic with chrome.i18n support
- **New Tab Page Override** — Glassmorphism command center replacing Chrome's new tab, with bookmarks, quick links, to-do, and session widgets

## New Tab Page Features

The new tab page override (`chrome_url_overrides.newtab`) provides:

- **Three Layout Modes** — Minimal (clock + search only), Focus (+ quick links + to-do + sessions), Dashboard (full layout with collapsible sidebar)
- **Bookmark Manager** — Multiple boards, glass category cards with drag-and-drop reorder (cards + entries), virtual scrolling for 200+ bookmarks, native Chrome bookmarks import
- **Quick Links Row** — Top sites auto-populated from `chrome.topSites`, drag-and-drop reorder, favicon chips, right-click edit/delete, `+` to add manually
- **To-Do Widget** — Multiple lists, priorities (High/Medium/Low), due dates with overdue highlighting, drag reorder, IndexedDB persistence
- **Session Widget** — Last 5 sessions with one-click restore (reuses existing `useSession` hook)
- **Customizable Background** — 15 gradient presets, solid color picker, user image upload (up to 5MB stored in IndexedDB), blur/dimming/saturation/brightness/vignette controls
- **Glassmorphism UI** — Frosted glass panels with `backdrop-filter: blur(16–24px) saturate(180%)`, smooth hover transitions
- **Light/Dark/Auto Themes** — Synced across all extension surfaces via `chrome.storage.local`
- **Card Density** — Compact (28px rows) or Comfortable (38px rows) for the bookmark grid
- **Global Keyboard Shortcuts** — Fully wired; `?` opens the full cheat sheet modal
- **Top Nav Tabs** — Quick Links / Frequently Visited / Tabs / Activity / All Bookmarks views

## Tech Stack

| Layer | Technology |
|-------|------------|
| Platform | Chrome Manifest V3 |
| Primary UI | Chrome Side Panel API |
| Framework | React 18 + TypeScript |
| State | Zustand |
| Styling | Tailwind CSS |
| Build | Vite + CRXJS |
| Storage | chrome.storage.local + IndexedDB |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Virtual Lists | @tanstack/react-virtual |
| Testing | Vitest + Testing Library |

## Project Structure

```
src/
├── background/          # Service worker, auto-save engine, event listeners
├── core/
│   ├── types/           # TypeScript interfaces (Session, Tab, Settings, Messages, NewTab)
│   ├── services/        # Business logic (session, search, import/export, newtab: bookmarks/todos/quicklinks/wallpaper/settings)
│   ├── storage/         # chrome.storage + IndexedDB adapters + NewTabDB (newtab-db)
│   └── utils/           # UUID, date formatting, validators, debounce
├── sidepanel/           # Primary UI — views, components, Zustand store
├── popup/               # Compact quick-action UI
├── dashboard/           # Full-page management — pages, components, store
├── newtab/              # New Tab page override
│   ├── App.tsx          # Root: data loading, layout router, overlays
│   ├── index.html/tsx   # Entry point
│   ├── stores/          # newtab.store.ts (single Zustand store)
│   ├── hooks/           # useNewTabSettings, useWallpaper, useClock, useKeyboardShortcuts, useBookmarkDnd
│   ├── layouts/         # MinimalLayout, FocusLayout, DashboardLayout
│   └── components/      # SearchBar, ClockWidget, QuickLinksRow, BookmarkBoard, BookmarkCategoryCard,
│                        # TodoWidget, SessionWidget, DashboardSidebar, TopNavTabs, WallpaperPicker,
│                        # SettingsPanel, KeyboardHelpModal, AddQuickLinkModal, BackgroundLayer,
│                        # FrequentlyVisitedPanel, TabsPanel, ActivityPanel
└── shared/
    ├── components/      # Button, Modal, Toast, Badge, ContextMenu, etc.
    ├── hooks/           # useSession, useTheme, useSearch, useMessaging, etc.
    └── styles/          # Tailwind globals, theme variables, glassmorphism utilities
```

## Development

```bash
# Install dependencies
npm install

# Development with HMR
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Load in Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `dist/` folder

## Keyboard Shortcuts

### Extension

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Toggle Side Panel |

### New Tab Page

| Shortcut | Action |
|----------|--------|
| `/` or `Ctrl+K` | Focus search |
| `Ctrl+Shift+L` | Cycle layout (Minimal→Focus→Dashboard) |
| `Ctrl+Shift+D` | Toggle density (Compact↔Comfortable) |
| `Ctrl+T` | Focus to-do input |
| `Ctrl+N` | Add bookmark to active category |
| `Ctrl+Shift+N` | New category |
| `Ctrl+1–9` | Switch board |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Open settings |
| `Ctrl+Shift+T` | Toggle theme |
| `Ctrl+Shift+W` | Open wallpaper picker |
| `Escape` | Close modal/overlay |
| `?` | Show keyboard shortcuts cheat sheet |

## Architecture

**Service Worker** handles all Chrome API interactions — tab queries, session save/restore, auto-save triggers, alarm management.

**Storage Layer** uses chrome.storage.local for settings/metadata and IndexedDB for session data (large payloads). The newtab feature uses a separate `newtab-db` IndexedDB database for bookmarks, quick links, to-do items, and wallpaper blobs — never touched by the background service worker.

**Message Protocol** — typed discriminated union messages between UI surfaces and service worker via `chrome.runtime.sendMessage`.

**UI Surfaces** — Side Panel (primary), Popup (quick actions), Dashboard (full management), New Tab (glassmorphism command center). All share components via `src/shared/`.

## License

MIT
