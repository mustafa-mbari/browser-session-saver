# Add "New Tab Page Override" Feature to Browser Hub

## Context
This is an existing Chrome Extension project called **Browser Hub** built with: React 18 + TypeScript, Zustand, Tailwind CSS, Vite + CRXJS, Framer Motion, Lucide React, chrome.storage.local + IndexedDB, and Manifest V3. The project already has a Side Panel, popup, dashboard, background service worker, and a shared core layer (types, services, storage, utils). Follow the existing project patterns and reuse shared components/hooks/services.

---

## Feature: New Tab Page Override

Add `chrome_url_overrides.newtab` to replace Chrome's default new tab with a glassmorphism command center for bookmarks, quick links, a to-do list, and session management.

### Manifest Changes
- Add `"chrome_url_overrides": { "newtab": "newtab.html" }` to manifest.json
- Add permissions: `topSites`, `bookmarks`, `favicon`
- Add host_permissions: `"chrome://favicon/*"`
- Add optional permission: `history`

### Vite Config
- Add `newtab: 'src/newtab/index.html'` as a new entry point alongside sidepanel, popup, dashboard, and background.

---

## Three Layout Modes

Users switch with `Ctrl+Shift+L` or a settings picker. Choice persists in chrome.storage.local.

1. **Minimal** — Search bar + clock + wallpaper only. No sidebar, no cards, no widgets.
2. **Focus** — Search bar + clock + quick links row + to-do widget. No sidebar, no bookmark grid.
3. **Dashboard** — Full layout: sidebar + search bar + clock + quick links + bookmark card grid + to-do widget + session widget.

---

## Glassmorphism UI

Every panel uses frosted glass styling: semi-transparent background (~8% white opacity in dark, ~55% in light), `backdrop-filter: blur(16px) saturate(180%)`, subtle 1px semi-transparent border, soft shadow, inset top highlight. Hover lifts 1px with 200ms transition. Elevated surfaces (modals, menus) use 24px blur + deeper shadow.

**Glass hierarchy:** Sidebar (20px blur, flush), Search Bar (24px blur, pill 24px radius), Category Cards (16px blur, 16px radius), To-Do Widget (16px blur, 16px radius), Quick Link Chips (12px blur, circle), Modals (24px blur, 20px radius).

### Themes: Dark (default), Light, Auto
- Dark: dark-tinted glass, white text
- Light: white-tinted glass, dark text  
- Auto: follows OS `prefers-color-scheme`
- Toggle with `Ctrl+Shift+T`, 300ms crossfade animation
- Use CSS custom properties for instant switching

---

## Wallpaper & Background System

**Types:** Solid color (picker + presets), Gradient (15+ presets + custom builder with angle control), Built-in wallpapers (bundle 15 images: nature/abstract/space/city), User upload (JPG/PNG/WebP, max 5MB, stored in IndexedDB as blob, max 10 images), Daily rotation.

**Adjustments (CSS filters on background layer only):** Blur (0–30px, default 0), Dimming (0–80%, default 30%), Saturation (50–150%, default 100%), Brightness (50–120%, default 100%), Vignette toggle (radial dark edges).

Open wallpaper picker: `Ctrl+Shift+W`.

---

## Quick Links Row

Horizontal row of circular glass favicon shortcuts below the search bar:
- Auto-populate top 8 from `chrome.topSites.get()`
- "+" button to manually add URL + label
- Drag-and-drop reorder (use @dnd-kit sortable horizontal strategy)
- Right-click to edit/delete
- 56px circle container, 40px favicon, hover scales 1.1x with glow ring
- Max 10 visible, horizontally scrollable
- Single click opens in current tab, middle-click in new tab

---

## Bookmark Management

### Boards
- Multiple boards (e.g., "Work", "Personal", "Research")
- Default "My Board" on first install with sample categories
- Switch via sidebar or `Ctrl+1`–`Ctrl+9`
- CRUD: create, rename, delete, reorder, duplicate

### Category Cards (Drag-and-Drop Glass Cards)
- Responsive grid: 2–4 columns based on screen width
- Each card = glass panel with: header (icon + name + 3-dot menu), bookmark list (favicon + name per row), "+ Add Bookmark" at bottom
- **Drag entire card** to reorder in grid (@dnd-kit sortable grid strategy)
- **Drag bookmarks between cards** (@dnd-kit with droppable category zones)
- Collapse/expand by clicking header (shows only title + count badge)
- Context menu: rename, change icon, duplicate, delete, change accent color (8 colors)
- Visual drag feedback: ghost at 50% opacity, drop zones with dashed border
- Touch support: PointerSensor + TouchSensor with 250ms delay
- Keyboard DnD: Enter to grab, arrow keys to move, Enter to drop

### Card Density (Compact / Comfortable)
Toggle with `Ctrl+Shift+D`, persists in storage.
- **Compact:** 28px row, 12px font, 16px favicon, 8px/10px padding, 12px gap — for hundreds of bookmarks
- **Comfortable (default):** 38px row, 14px font, 20px favicon, 12px/16px padding, 16px gap — balanced

### Performance at Scale
- Virtual scrolling via @tanstack/react-virtual when bookmarks > 200
- Windowed card rendering: viewport + 1-screen buffer
- Aggressive favicon caching
- Target: 500 bookmarks across 30 categories in < 200ms, 60fps scroll

### Native Bookmarks Integration
- One-click import from `chrome.bookmarks.getTree()`
- Optional two-way sync
- Sidebar tree: Bookmarks Bar, Other Bookmarks, Mobile Bookmarks
- "Grouped by Website" auto-categorizes by domain
- Import conflict resolution: skip/merge/overwrite

### Bookmark Search
- Full-text across name, URL, category, board
- Real-time debounced (200ms), highlighted matches
- `Ctrl+K` or `/` focuses search

---

## Built-in To-Do List Widget

Visible in Focus and Dashboard modes. Glass panel styling matching cards.

**Features:** Inline add (Enter to submit), checkbox completion (strikethrough + moves to Done), delete (swipe or trash icon), drag-and-drop reorder (@dnd-kit sortable), priority (🔴 High / 🟡 Medium / 🟢 Low color dots), optional due date (overdue = red), multiple lists ("Today", "Work", "Personal" switchable via tabs), persistent in IndexedDB, `Ctrl+T` focuses input.

**Layout:** Header with title + list switcher dropdown, input field, active tasks list, collapsible "Completed (N)" section (collapsed by default), "Clear all completed" button. Position: right column in Dashboard, below quick links in Focus.

**Data models:**
- TodoItem: id, text, completed, priority (high/medium/low/none), dueDate?, listId, position, createdAt, completedAt?
- TodoList: id, name, icon (emoji), position, createdAt

---

## Global Keyboard Shortcuts

All customizable. `?` shows cheat sheet modal.

| Shortcut | Action |
|---|---|
| `/` or `Ctrl+K` | Focus search |
| `Ctrl+Shift+L` | Cycle layout (Minimal→Focus→Dashboard) |
| `Ctrl+Shift+D` | Toggle density (Compact↔Comfortable) |
| `Ctrl+T` | Focus to-do input |
| `Ctrl+N` | Add bookmark to active category |
| `Ctrl+Shift+N` | Create new category |
| `Ctrl+1`–`Ctrl+9` | Switch board |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Open settings |
| `Escape` | Close modal/deselect |
| `Delete` | Delete focused bookmark (with undo) |
| `Ctrl+Z` | Undo last action |
| `Ctrl+Shift+T` | Toggle theme |
| `Ctrl+Shift+W` | Open wallpaper picker |

---

## Top Navigation Tabs

Below search bar: **Quick Links** (default, grid), **Frequently Visited** (topSites + history), **Tabs** (current open tabs with tab groups — Browser Hub integration), **Activity** (bookmark activity log), **All** (flat searchable list of all bookmarks).

---

## Sidebar (Dashboard only, collapsible with Ctrl+B)

- **Boards list** with DnD reorder + "New Board" button
- **Native Bookmarks** expandable tree + "Grouped by Website"
- **Bottom:** Get Pro button, Zen Mode toggle (hides sidebar), Backup & Restore link (reuses existing import/export), Trash (30-day restore), Help link

---

## Browser Hub Integration

- Session widget: last 3–5 saved sessions with one-click restore
- Save Session button accessible from all layouts
- Auto-save status badge (active/paused/last time)
- Tabs view shows current tabs with tab group colors
- Reuse existing shared hooks: useSession, useAutoSave, useTheme, useMessaging
- Reuse existing core services: session.service, tab-group.service, search.service
- Unified theme + settings store across all surfaces

---

## Feature Toggle

Settings → Interface → New Tab Page → Enable/Disable. When disabled, the page redirects to `chrome://new-tab-page` via `location.replace()` since Chrome doesn't support dynamic chrome_url_overrides toggling.

---

## Data Models

- **Board:** id, name, icon, categoryIds (ordered), createdAt, updatedAt
- **BookmarkCategory:** id, boardId, name, icon, color (hex), bookmarkIds (ordered), collapsed, createdAt
- **BookmarkEntry:** id, categoryId, title, url, favIconUrl, addedAt, isNative, nativeId?
- **QuickLink:** id, title, url, favIconUrl, position, isAutoGenerated
- **NewTabSettings:** enabled, layoutMode, cardDensity, searchEngine (+customUrl), clockFormat, show toggles (clock/quicklinks/bookmarks/todo/session widget), backgroundType/color/gradient/gradientAngle/imageId, blur/dimming/saturation/brightness/vignette, dailyRotation, theme, defaultView, activeBoardId, zenMode, sidebarCollapsed

---

## Project Structure

Create `src/newtab/` with: App.tsx (root with layout mode router), index.tsx, index.html, layouts/ (MinimalLayout, FocusLayout, DashboardLayout), views/ (QuickLinksView, FrequentView, TabsView, ActivityView, AllBookmarksView), components/ (SearchBar, ClockWidget, QuickLinksRow, BookmarkGrid, CategoryCard, BookmarkItem, Sidebar, BoardSwitcher, TodoWidget, TodoItem, SessionWidget, BackgroundLayer, BackgroundPicker, TopNav, CustomizePanel, DensityToggle, LayoutModePicker, KeyboardShortcutsModal, TrashBin, GlassContainer), stores/ (newtab.store, bookmarks.store, quicklinks.store, todo.store, background.store), services/ (bookmarks.service, topsites.service, quicklinks.service, todo.service).

Also add to shared/hooks/: useDragAndDrop, useGlass.

---

## Performance Targets

- Page load < 300ms (code-split by layout: Minimal ~60KB, Dashboard ~200KB gzipped)
- FCP < 150ms, 60fps scroll and drag, search < 100ms, wallpaper load < 500ms, memory < 25MB
