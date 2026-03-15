# Session Saver — Chrome Extension

Save, restore, and manage your browser sessions with one click. Auto-save protects your tabs before shutdown, sleep, or low battery.

## Features

- **One-Click Save** — Save all tabs from the current window instantly
- **Auto-Save Engine** — Automatically saves before browser close, system sleep, low battery, periodic timer, and window close; one pinned entry per trigger type, updated in place instead of accumulating
- **Tab Group Support** — Full-fidelity save/restore of Chrome tab groups with colors, names, and collapsed state
- **Tab Groups Management** — Dedicated UI for viewing live Chrome tab groups, saving templates, auto-saving groups, and restoring with color/name fidelity
- **Subscriptions Tracker** — Track recurring subscriptions with calendar view, analytics dashboard, spending breakdown by category, CSV import/export, and reminder toast on new tab
- **Side Panel UI** — Primary interface docked to the browser for always-accessible session management
- **Search & Filter** — Full-text search across session names, tags, URLs, and titles; `#tag` syntax for tag-based filtering
- **Import/Export** — Export as JSON, HTML bookmarks, Markdown, CSV, or plain text; import from JSON, HTML, or URL lists
- **Dark Mode** — Light/dark/system theme support synced across all extension surfaces
- **Dashboard** — Full-page management with 5 pages: Sessions (bulk merge/compare/export/delete, stats), Auto-Saves, Tab Groups, Import/Export, Settings
- **Virtual Scrolling** — Handles 500+ sessions with smooth performance via @tanstack/react-virtual; lists ≤30 items use plain DOM, >30 items use virtualizer (3-column grid for sessions, flat list with date headers for auto-saves)
- **Scroll Position Capture** — Content script captures per-tab scroll position for full-fidelity session restore
- **i18n** — English and Arabic with chrome.i18n support (~282 message keys including tab groups, subscriptions, error boundaries, and auto-saves)
- **New Tab Page Override** — Glassmorphism command center replacing Chrome's new tab, with bookmarks, quick links, to-do, session, subscription, and tab group widgets

## New Tab Page Features

The new tab page override (`chrome_url_overrides.newtab`) provides:

- **Three Layout Modes** — Minimal (clock + search only), Focus (+ quick links + to-do + sessions), Dashboard (full layout with collapsible sidebar)
- **Bookmark Manager** — Multiple boards, glass category cards with drag-and-drop reorder (cards + entries), virtual scrolling for 200+ bookmarks, native Chrome bookmarks import
- **Six Card Types** — Bookmark (category with entries), Clock (analog/digital), Note (text), To-Do (task list), Subscription (billing tracker), Tab Groups (live group display)
- **Quick Links Row** — Top sites auto-populated from `chrome.topSites`, drag-and-drop reorder, favicon chips, right-click edit/delete, `+` to add manually
- **To-Do Widget** — Multiple lists, priorities (High/Medium/Low), due dates with overdue highlighting, drag reorder, IndexedDB persistence
- **Session Widget** — Last 5 sessions with one-click restore
- **Subscription Card** — Upcoming renewals, monthly spending total, overdue/due-soon indicators with color-coded urgency, inline SVG charts for spending analytics
- **Tab Groups Card** — Live Chrome tab groups display with color-coded badges, click-to-focus, auto-refresh
- **Subscription Reminder** — Glassmorphism toast notification for overdue or due-soon subscriptions with 24-hour snooze
- **Sidebar Panels** — Sessions, Auto-Saves, Tab Groups, Import/Export, Subscriptions — full management views accessible from dashboard sidebar; panels are `React.lazy`-loaded for fast initial render
- **Customizable Background** — 15 gradient presets, solid color picker, user image upload (up to 5MB stored in IndexedDB), blur/dimming/saturation/brightness/vignette controls
- **Glassmorphism UI** — Frosted glass panels with `backdrop-filter: blur(16–24px) saturate(180%)`, smooth hover transitions
- **Light/Dark/Auto Themes** — Synced across all extension surfaces via `chrome.storage.local`
- **Card Density** — Compact (28px rows) or Comfortable (38px rows) for the bookmark grid
- **Global Keyboard Shortcuts** — Fully wired; `?` opens the full cheat sheet modal
- **Top Nav Tabs** — Quick Links / Frequently Visited / Tabs / Activity views

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
| Testing | Vitest + Testing Library (53 tests, 10 files) |

## Project Structure

```
src/
├── background/              # Service worker, auto-save engine, event listeners, alarms
├── content/                 # Content script for scroll position capture
│   └── scroll-capture.ts
├── core/
│   ├── types/               # TypeScript interfaces
│   │   ├── session.types.ts       # Session, Tab, TabGroup, AutoSaveTrigger, ChromeGroupColor
│   │   ├── newtab.types.ts        # Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoItem, CardType
│   │   ├── messages.types.ts      # Message protocol (15 action types)
│   │   ├── subscription.types.ts  # Subscription, SubscriptionTemplate, BillingCycle
│   │   ├── tab-group.types.ts     # TabGroupTemplate, TabGroupTemplateTab
│   │   ├── settings.types.ts      # Settings, AutoSaveSettings
│   │   └── storage.types.ts       # StorageMetadata, schema version
│   ├── services/            # Business logic
│   │   ├── session.service.ts           # Session CRUD, upsert auto-save, merge, diff
│   │   ├── subscription.service.ts      # Urgency, analytics, CSV import/export, currency formatting
│   │   ├── search.service.ts            # Full-text session search
│   │   ├── export.service.ts            # JSON, HTML, Markdown, CSV, text export
│   │   ├── import.service.ts            # JSON, HTML, URL list import
│   │   ├── tab-group.service.ts         # Capture/restore Chrome tab groups
│   │   ├── bookmark.service.ts          # Board/category/entry CRUD
│   │   ├── todo.service.ts              # To-do list/item CRUD
│   │   ├── quicklinks.service.ts        # Quick links sync with topSites
│   │   ├── wallpaper.service.ts         # Background image handling
│   │   ├── newtab-settings.service.ts   # NewTabSettings persistence
│   │   ├── seed.service.ts              # First-launch default data
│   │   └── migration.service.ts         # Version-based migration framework
│   ├── constants/           # GROUP_COLORS (ChromeGroupColor → CSS hex)
│   ├── storage/             # Storage adapters
│   │   ├── storage.interface.ts           # IStorage interface
│   │   ├── chrome-local-key-adapter.ts    # Generic ChromeLocalKeyAdapter<T>
│   │   ├── chrome-storage.ts              # chrome.storage.local adapter
│   │   ├── indexeddb.ts                   # IndexedDB adapter (session-saver db)
│   │   ├── newtab-storage.ts              # NewTabDB (newtab-db, 7 stores)
│   │   ├── subscription-storage.ts        # chrome.storage.local (subscriptions key)
│   │   ├── tab-group-template-storage.ts  # chrome.storage.local (tab_group_templates key)
│   │   └── storage-factory.ts             # Singleton factory
│   └── utils/               # UUID, date formatting, validators, debounce, favicon
├── sidepanel/               # Primary UI — Side Panel
│   ├── views/               # HomeView, SessionDetailView, TabGroupsView, SettingsView,
│   │                        # ImportExportView, SubscriptionsView
│   ├── components/          # Header, NavigationStack, SessionList, SessionCard,
│   │   │                    # SearchBar, QuickActions, TabGroupPreview, AutoSaveBadge
│   │   └── subscriptions/   # SubscriptionForm, SubscriptionList, SubscriptionRow,
│   │                        # SubscriptionCalendar, SubscriptionAnalytics,
│   │                        # SubscriptionSummaryStrip, QuickAddTemplates
│   └── stores/              # sidepanel.store.ts (navigation, filters, sort)
├── popup/                   # Compact quick-action UI
├── dashboard/               # Full-page management
│   ├── pages/               # SessionsPage, AutoSavesPage, TabGroupsPage,
│   │                        # ImportExportPage, SettingsPage
│   ├── components/          # Sidebar, SessionDetail, StatsWidget, BulkToolbar
│   └── stores/              # dashboard.store.ts
├── newtab/                  # New Tab page override
│   ├── App.tsx              # Root: data loading, layout router, overlays
│   ├── index.html/tsx       # Entry point
│   ├── stores/              # newtab.store.ts (single Zustand store)
│   ├── hooks/               # useNewTabSettings, useWallpaper, useClock,
│   │                        # useKeyboardShortcuts, useBookmarkDnd
│   ├── contexts/            # BookmarkBoardContext (board-level actions, eliminates prop-drilling)
│   ├── layouts/             # MinimalLayout, FocusLayout, DashboardLayout
│   └── components/          # SearchBar, ClockWidget, QuickLinksRow, BookmarkBoard,
│                            # BookmarkCategoryCard, BookmarkCardBody, NoteCardBody,
│                            # TodoCardBody, BookmarkEntryRow, ResizePopover,
│                            # TodoWidget, SessionWidget, DashboardSidebar, TopNavTabs,
│                            # WallpaperPicker, SettingsPanel, KeyboardHelpModal,
│                            # AddQuickLinkModal, AddCardModal, BackgroundLayer,
│                            # NewTabHeader, SubscriptionCardBody, TabGroupsCardBody,
│                            # SubscriptionReminder, SessionsPanel*, AutoSavesPanel*,
│                            # TabGroupsPanel*, SubscriptionsPanel*, ImportExportPanel,
│                            # FrequentlyVisitedPanel, TabsPanel, ActivityPanel
│                            # (* = React.lazy loaded)
└── shared/
    ├── components/          # Button, Modal, Toast, Badge, ContextMenu (keyboard nav),
    │                        # ErrorBoundary, EmptyState, LoadingSpinner, Tooltip
    ├── hooks/               # useSession, useTheme, useSearch, useMessaging,
    │                        # useKeyboard, useAutoSave
    ├── utils/               # i18n (t() wrapper for chrome.i18n.getMessage)
    └── styles/              # Tailwind globals, theme variables, glassmorphism utilities
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

### Side Panel

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Go to Sessions (Home) |
| `Ctrl+Shift+D` | Open Dashboard |
| `Ctrl+Shift+F` | Focus Search |
| `Ctrl+Shift+E` | Quick Export |

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

**Service Worker** handles all Chrome API interactions — tab queries, session save/restore, auto-save triggers, alarm management. Processes 15 typed message actions from UI surfaces.

**Storage Layer** uses chrome.storage.local for settings/metadata and IndexedDB (`session-saver` database) for session data (large payloads). The newtab feature uses a separate `newtab-db` IndexedDB database for bookmarks, quick links, to-do items, and wallpaper blobs — never touched by the background service worker. Subscriptions and tab group templates are stored as flat keys in chrome.storage.local via the generic `ChromeLocalKeyAdapter<T>` class.

**Content Script** (`src/content/scroll-capture.ts`) runs in web pages to capture scroll position (`window.scrollX`, `window.scrollY`) for full-fidelity session restore.

**Message Protocol** — typed discriminated union messages (15 action types) between UI surfaces and service worker via `chrome.runtime.sendMessage`.

**UI Surfaces** — Side Panel (primary, 6 views), Popup (quick actions), Dashboard (5 pages), New Tab (glassmorphism command center with 3 layout modes). All share components via `src/shared/`.

## License

MIT
