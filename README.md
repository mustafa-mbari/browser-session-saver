# Session Saver — Chrome Extension

Save, restore, and manage your browser sessions with one click. Auto-save protects your tabs before shutdown, sleep, or low battery.

## Features

- **One-Click Save** — Save all tabs from the current window instantly
- **Auto-Save Engine** — Automatically saves before browser close, system sleep, low battery, periodic timer, and window close
- **Tab Group Support** — Full-fidelity save/restore of Chrome tab groups with colors, names, and collapsed state
- **Side Panel UI** — Primary interface docked to the browser for always-accessible session management
- **Search & Filter** — Full-text search across session names, tags, URLs, and titles
- **Import/Export** — Export as JSON, HTML bookmarks, Markdown, CSV, or plain text; import from JSON, HTML, or URL lists
- **Dark Mode** — Light/dark/system theme support
- **Dashboard** — Full-page management with bulk operations, stats, and advanced settings
- **Virtual Scrolling** — Handles 500+ sessions with smooth performance
- **i18n** — English and Arabic with chrome.i18n support

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
| Testing | Vitest + Testing Library |

## Project Structure

```
src/
├── background/          # Service worker, auto-save engine, event listeners
├── core/
│   ├── types/           # TypeScript interfaces (Session, Tab, Settings, Messages)
│   ├── services/        # Business logic (CRUD, search, import, export, migration)
│   ├── storage/         # Storage abstraction (chrome.storage + IndexedDB)
│   └── utils/           # UUID, date formatting, validators, debounce
├── sidepanel/           # Primary UI — views, components, Zustand store
├── popup/               # Compact quick-action UI
├── dashboard/           # Full-page management — pages, components, store
├── shared/
│   ├── components/      # Button, Modal, Toast, Badge, ContextMenu, etc.
│   ├── hooks/           # useSession, useTheme, useSearch, useMessaging, etc.
│   └── styles/          # Tailwind globals, theme variables
└── content/             # Scroll position capture content script
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

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Toggle Side Panel |

## Architecture

**Service Worker** handles all Chrome API interactions — tab queries, session save/restore, auto-save triggers, alarm management.

**Storage Layer** uses chrome.storage.local for settings/metadata and IndexedDB for session data (large payloads).

**Message Protocol** — typed discriminated union messages between UI surfaces and service worker via `chrome.runtime.sendMessage`.

**UI Surfaces** — Side Panel (primary), Popup (quick actions), Dashboard (full management). All share components via `src/shared/`.

## License

MIT
