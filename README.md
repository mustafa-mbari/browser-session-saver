# Browser Hub — Chrome Extension

Save, restore, and manage your browser sessions with one click. Auto-save protects your tabs before shutdown, sleep, or low battery.

## Features

- **One-Click Save** — Save all tabs from the current window instantly
- **Auto-Save Engine** — Automatically saves before browser close, system sleep, low battery, periodic timer, and window close; one pinned entry per trigger type, updated in place instead of accumulating
- **Tab Group Support** — Full-fidelity save/restore of Chrome tab groups with colors, names, and collapsed state
- **Tab Groups Management** — Dedicated UI for viewing live Chrome tab groups, saving templates, auto-saving groups, and restoring with color/name fidelity
- **Subscriptions Tracker** — Track recurring subscriptions with calendar view, analytics dashboard, spending breakdown by category, CSV import/export, and reminder toast on start-tab
- **Prompt Manager** — Personal prompt library with folders, pinning, favorites, variable fill-in (`{{variable}}` syntax), source tagging (Local/App), and quick copy; accessible from side panel and start-tab widget
- **Cloud Sync** — Sign in from the side panel to push sessions, prompts, and subscriptions to Supabase; quota-aware (Free/Pro/Max), 15-minute background sync, manual "Sync Now" button, and usage bars in the Cloud Sync view
- **Side Panel UI** — Primary interface docked to the browser for always-accessible session management
- **Search & Filter** — Full-text search across session names, tags, URLs, and titles; `#tag` syntax for tag-based filtering
- **Import/Export** — Export as JSON, HTML bookmarks, Markdown, CSV, or plain text; import from JSON, HTML, or URL lists
- **Dark Mode** — Light/dark/system theme support synced across all extension surfaces
- **Start-Tab Sidebar** — Full management via sidebar panels: Sessions (bulk merge/compare/export/delete, stats), Auto-Saves, Tab Groups, Import/Export, Subscriptions, Settings
- **Virtual Scrolling** — Handles 500+ sessions with smooth performance via @tanstack/react-virtual; lists ≤30 items use plain DOM, >30 items use virtualizer (3-column grid for sessions, flat list with date headers for auto-saves)
- **i18n** — English, Arabic, and German with chrome.i18n support (~282 message keys including tab groups, subscriptions, error boundaries, and auto-saves)
- **Start-Tab** — Glassmorphism command center replacing Chrome's new tab, with bookmarks, quick links, to-do, session, subscription, tab group, and prompt widgets

## Start-Tab Features

The start-tab (`chrome_url_overrides.newtab`) provides:

- **Three Layout Modes** — Minimal (clock + search only), Focus (+ quick links + to-do + sessions), Dashboard (full layout with collapsible sidebar)
- **Bookmark Manager** — Multiple boards, glass widgets with drag-and-drop reorder (widgets + entries), virtual scrolling for 200+ bookmarks, native Chrome bookmarks import
- **Seven Widget Types** — Bookmark (category with entries), Clock (analog/digital), Note (text), To-Do (task list), Subscription (billing tracker), Tab Groups (live group display), Prompt Manager (pinned + recent prompts)
- **Widget Sizing System** — Central widget configuration registry with per-type min/max/default sizes, resize popover with constraint enforcement, responsive widget content
- **Quick Links Row** — Top sites auto-populated from `chrome.topSites`, drag-and-drop reorder, favicon chips, right-click edit/delete, `+` to add manually
- **To-Do Widget** — Multiple lists, priorities (High/Medium/Low), due dates with overdue highlighting, drag reorder, IndexedDB persistence
- **Session Widget** — Last 5 sessions with one-click restore
- **Subscription Widget** — Upcoming renewals, monthly spending total, overdue/due-soon indicators with color-coded urgency, inline SVG charts for spending analytics
- **Tab Groups Widget** — Live Chrome tab groups display with color-coded badges, click-to-focus, auto-refresh
- **Prompt Manager Widget** — Pinned and recent prompts with one-click copy and variable fill-in modal
- **Subscription Reminder** — Glassmorphism toast notification for overdue or due-soon subscriptions with 24-hour snooze
- **Sidebar Panels** — Sessions, Auto-Saves, Tab Groups, Import/Export, Subscriptions — full management views accessible from dashboard sidebar; panels are `React.lazy`-loaded for fast initial render
- **Customizable Background** — 15 gradient presets, solid color picker, user image upload (up to 5MB stored in IndexedDB), blur/dimming/saturation/brightness/vignette controls
- **Glassmorphism UI** — Frosted glass panels with `backdrop-filter: blur(16–24px) saturate(180%)`, smooth hover transitions
- **Light/Dark/Auto Themes** — Synced across all extension surfaces via `chrome.storage.local`
- **Widget Density** — Compact (28px rows) or Comfortable (38px rows) for the bookmark grid
- **Global Keyboard Shortcuts** — Fully wired; `?` opens the full cheat sheet modal
- **Top Nav Tabs** — Quick Links / Frequently Visited / Tabs / Activity views

## Companion Apps

### Web App (`web/`) — port 3000
User-facing Next.js app with Dashboard (synced-item counts and plan limits via `get_user_quota` + `get_user_usage` RPCs), Billing (plan comparison, Checkout), Settings, Support tickets, and Feature suggestions. Auth flows: Login (email/password + Google OAuth), Register, Forgot Password, Reset Password, Verify Email. Shares the same Supabase project as the extension. Requires `NEXT_PUBLIC_SITE_URL` env var for auth redirect URLs.

### Admin App (`admin/`) — port 3001
Internal admin panel with Overview (user stats + `total_tab_groups` via `get_admin_overview` RPC), Users, Statistics, Promo Codes, Subscriptions, Webhooks, Tickets, Suggestions, Quotas, and Emails — all backed by real Supabase data via service-role client. See `admin/.env.local.example` for required env vars.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Platform | Chrome Manifest V3 |
| Primary UI | Chrome Side Panel API |
| Framework | React 18 + TypeScript |
| State | Zustand (split UI + data stores) |
| Styling | Tailwind CSS |
| Build | Vite + CRXJS |
| Storage | chrome.storage.local + IndexedDB (v2, indexed) |
| Cloud | Supabase (PostgreSQL + Auth + RPC) |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Virtual Lists | @tanstack/react-virtual |
| Testing | Vitest + Testing Library (256 tests, 21 files) |

## Project Structure

```
src/
├── background/              # Service worker, auto-save engine, event listeners, alarms
├── core/
│   ├── types/               # TypeScript interfaces
│   │   ├── session.types.ts       # Session, Tab, TabGroup, AutoSaveTrigger, ChromeGroupColor
│   │   ├── newtab.types.ts        # Board, BookmarkCategory, BookmarkEntry, QuickLink, TodoItem, CardType
│   │   ├── messages.types.ts      # Message protocol (19 action types)
│   │   ├── subscription.types.ts  # Subscription, SubscriptionTemplate, BillingCycle
│   │   ├── tab-group.types.ts     # TabGroupTemplate, TabGroupTemplateTab
│   │   ├── prompt.types.ts        # Prompt, PromptFolder, PromptCategory, PromptTag, PromptSectionKey
│   │   ├── settings.types.ts      # Settings, AutoSaveSettings
│   │   └── storage.types.ts       # StorageMetadata, schema version
│   ├── config/              # Widget configuration registry (widget-config.ts)
│   ├── supabase/            # Supabase singleton client (chrome.storage.local auth adapter)
│   ├── services/            # Business logic
│   │   ├── session.service.ts           # Session CRUD, upsert auto-save, merge, diff
│   │   ├── subscription.service.ts      # Urgency, analytics, CSV import/export, currency formatting
│   │   ├── prompt.service.ts            # Filter, sort, folder tree, variable extraction
│   │   ├── sync-auth.service.ts         # Supabase auth wrapper (signIn, signOut, getUserId)
│   │   ├── sync.service.ts              # Cloud sync orchestrator (push sessions/prompts/subs)
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
│   │   ├── indexeddb.ts                   # IndexedDB adapter (browser-hub db v2, indexed)
│   │   ├── newtab-storage.ts              # NewTabDB (newtab-db, 7 stores)
│   │   ├── subscription-storage.ts        # chrome.storage.local (subscriptions key)
│   │   ├── prompt-storage.ts              # chrome.storage.local (prompts, prompt_folders keys)
│   │   ├── tab-group-template-storage.ts  # chrome.storage.local (tab_group_templates key)
│   │   └── storage-factory.ts             # Singleton factory
│   └── utils/               # UUID, date formatting, validators, debounce, favicon
├── sidepanel/               # Primary UI — Side Panel
│   ├── views/               # HomeView, SessionDetailView, TabGroupsView, SettingsView,
│   │                        # ImportExportView, SubscriptionsView, PromptsView, CloudSyncView
│   ├── components/          # Header, NavigationStack, SessionList, SessionCard,
│   │   │                    # SearchBar, QuickActions, TabGroupPreview, AutoSaveBadge,
│   │   │                    # CurrentTabsPanel, HomeTabGroupsPanel, HomeLiveGroupRow,
│   │   │                    # HomeSavedGroupRow (extracted from HomeView)
│   │   ├── subscriptions/   # SubscriptionForm, SubscriptionList, SubscriptionRow,
│   │   │                    # SubscriptionCalendar, SubscriptionAnalytics,
│   │   │                    # SubscriptionSummaryStrip, QuickAddTemplates
│   │   └── prompts/         # PromptSectionNav, PromptList, PromptCard, PromptForm,
│   │                        # PromptVariablesModal
│   └── stores/              # sidepanel.store.ts (navigation, filters, sort)
├── popup/                   # Compact quick-action UI
├── newtab/                  # Start-tab (new tab page override)
│   ├── App.tsx              # Root: data loading, layout router, overlays
│   ├── index.html/tsx       # Entry point
│   ├── stores/              # newtab-ui.store.ts (UI state), newtab-data.store.ts (data),
│   │                        # newtab.store.ts (facade re-exporting both)
│   ├── hooks/               # useNewTabSettings, useWallpaper, useClock,
│   │                        # useKeyboardShortcuts, useBookmarkDnd
│   ├── contexts/            # BookmarkBoardContext (board-level actions, eliminates prop-drilling)
│   ├── layouts/             # MinimalLayout, FocusLayout, DashboardLayout
│   └── components/          # SearchBar, ClockWidget, QuickLinksRow, BookmarkBoard,
│                            # BookmarkCategoryCard, BookmarkCardBody, NoteCardBody,
│                            # TodoCardBody, BookmarkEntryRow, ResizePopover,
│                            # TodoWidget, SessionWidget, DashboardSidebar, TopNavTabs,
│                            # WallpaperPicker, SettingsPanel, KeyboardHelpModal,
│                            # AddQuickLinkModal, AddWidgetModal, BackgroundLayer,
│                            # NewTabHeader, SubscriptionCardBody, TabGroupsCardBody,
│                            # PromptCardBody, SubscriptionReminder, SessionsPanel*,
│                            # AutoSavesPanel*, TabGroupsPanel*, SubscriptionsPanel*,
│                            # PromptsPanel*, ImportExportPanel,
│                            # FrequentlyVisitedPanel, TabsPanel, ActivityPanel
│                            # (* = React.lazy loaded)
└── shared/
    ├── components/          # Button, Modal, Toast, Badge, ContextMenu (keyboard nav),
    │                        # ErrorBoundary, EmptyState, LoadingSpinner, Tooltip
    ├── hooks/               # useSession, useTheme, useSearch, useMessaging,
    │                        # useKeyboard, useAutoSave
    ├── utils/               # i18n (t() wrapper for chrome.i18n.getMessage)
    └── styles/              # Tailwind globals, theme variables, glassmorphism utilities

supabase/
└── migrations/              # 16 SQL migrations (001–016):
                             #   001–011: auth/profiles, plans, user_plans, promo_codes,
                             #            sessions, prompts, tracked_subscriptions,
                             #            bookmark_folders, admin_tables, triggers,
                             #            quota_functions
                             #   012: tab_group_templates table
                             #   013: total_tabs_limit, bookmark board/native columns
                             #   014: get_user_usage synced_tabs, get_admin_overview total_tab_groups
                             #   015: tab_groups_synced_limit
                             #   016: get_user_usage synced_tab_groups

web/                         # Next.js 16 user web app (port 3000)
admin/                       # Next.js 16 admin panel (port 3001)
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

## Environment Variables

**Extension** — create `.env` at project root (see `.env.example`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
Injected at build time by Vite. Omitting them disables cloud sync gracefully.

**Web app** — create `web/.env.local` (see `web/.env.local.example` if present):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

**Admin app** — create `admin/.env.local` (see `admin/.env.local.example`):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Keyboard Shortcuts

### Extension

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Toggle Side Panel |

### Side Panel

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Go to Home |
| `Ctrl+Shift+P` | Open Prompt Manager |
| `Ctrl+Shift+S` | Open Subscriptions |

### Start-Tab

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

**Service Worker** handles all Chrome API interactions — tab queries, session save/restore, auto-save triggers, alarm management, and cloud sync mutations. Processes 19 typed message actions from UI surfaces.

**Storage Layer** uses chrome.storage.local for settings/metadata and IndexedDB (`browser-hub` database, v2 with `isAutoSave` and `createdAt` indexes) for session data (large payloads). The start-tab feature uses a separate `newtab-db` IndexedDB database for bookmarks, quick links, to-do items, and wallpaper blobs — never touched by the background service worker. Subscriptions, tab group templates, and prompts are stored as flat keys in chrome.storage.local via the generic `ChromeLocalKeyAdapter<T>` class.

**Cloud Sync** uses `@supabase/supabase-js` with a custom `chrome.storage.local` auth adapter (no cookies in extensions). Sessions, prompts, subscriptions, tab group templates, and bookmark folders are pushed to Supabase on save and via a 15-minute alarm. Quota limits (Free/Pro/Max) are enforced using the `get_user_quota` RPC (plan limits); the `get_user_usage` RPC returns current synced counts and is used by the web dashboard.

**Message Protocol** — typed discriminated union messages (19 action types) between UI surfaces and service worker via `chrome.runtime.sendMessage`.

**UI Surfaces** — Side Panel (primary, 8 views), Popup (quick actions), Start-Tab (glassmorphism command center with 3 layout modes and sidebar management panels). All share components via `src/shared/`.

## License

MIT
