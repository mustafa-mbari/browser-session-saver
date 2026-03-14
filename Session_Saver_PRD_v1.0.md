# SESSION SAVER — Chrome Extension

## Product Requirements Document

**Version:** 1.0  
**Date:** March 2026  
**Status:** Draft  
**Classification:** Internal

---

## Table of Contents

1. [Document Overview](#1-document-overview)
2. [Product Vision & Strategy](#2-product-vision--strategy)
3. [User Personas & Use Cases](#3-user-personas--use-cases)
4. [Functional Requirements](#4-functional-requirements)
5. [Auto-Save Engine](#5-auto-save-engine)
6. [Tab Group Management](#6-tab-group-management)
7. [Session Management](#7-session-management)
8. [Import / Export System](#8-import--export-system)
9. [User Interface & Design](#9-user-interface--design)
10. [Side Panel Architecture](#10-side-panel-architecture)
11. [Technical Architecture](#11-technical-architecture)
12. [Project Structure](#12-project-structure)
13. [Chrome Web Store Requirements](#13-chrome-web-store-requirements)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Analytics & Metrics](#15-analytics--metrics)
16. [Release Roadmap](#16-release-roadmap)
17. [Risk Assessment](#17-risk-assessment)
18. [Future Enhancements](#18-future-enhancements)

---

## 1. Document Overview

### 1.1 Purpose

This Product Requirements Document (PRD) defines the full scope, technical architecture, and feature set for **Session Saver**, a Chrome extension that enables users to save, restore, and manage their browser sessions with a single click. The document serves as the definitive reference for development, design, and quality assurance teams.

### 1.2 Document Info

| Field | Details |
|---|---|
| Product Name | Session Saver |
| Version | 1.0.0 |
| Platform | Google Chrome (Manifest V3) |
| Primary UI | Chrome Side Panel (`chrome.sidePanel` API) |
| Target Release | Q2 2026 |
| Distribution | Chrome Web Store |
| License | Freemium (Free + Pro) |

### 1.3 Glossary

| Term | Definition |
|---|---|
| Session | A snapshot of all open tabs and their states at a given moment |
| Tab Group | Chrome's native colored tab grouping, preserved with full metadata |
| Auto-Save | Background process that automatically saves current session state |
| Session Saver | The Chrome extension product name |
| Side Panel | Chrome's built-in side panel UI surface (`chrome.sidePanel` API) that docks to the right of the browser |
| Manifest V3 | Chrome's latest extension platform with service workers |

---

## 2. Product Vision & Strategy

### 2.1 Vision Statement

Session Saver empowers users to never lose their browsing context. Whether due to a crash, shutdown, low battery, or intentional cleanup, every tab and tab group is preserved and instantly restorable, keeping users in flow without interruption.

### 2.2 Problem Statement

- Users lose all open tabs when the browser crashes, the computer sleeps unexpectedly, or the battery dies
- Chrome's built-in session restore is unreliable and does not support named sessions or selective restoration
- Tab group organization is lost when windows close, destroying hours of careful categorization
- No native way to save, name, and switch between multiple work contexts (e.g., Work vs. Personal vs. Research)
- Existing solutions have outdated UIs, lack auto-save, or do not support Manifest V3
- Current extensions use limited popups (800x600 max) that feel cramped for session management

### 2.3 Value Proposition

Session Saver is the fastest, most reliable way to save and restore your complete browsing state. One click saves everything. Smart auto-save protects you before shutdowns, sleep, or low battery. The always-visible Side Panel makes session management effortless without leaving your current workflow.

### 2.4 Target Audience

- Power users who keep 20+ tabs open at any time
- Developers and researchers who context-switch between projects
- Students managing coursework, research, and personal browsing
- Remote workers juggling multiple client workspaces
- Anyone who has ever lost tabs and wished they could get them back

### 2.5 Competitive Analysis

| Feature | Session Saver | OneTab | Session Buddy | Tab Session Mgr |
|---|---|---|---|---|
| One-Click Save All Tabs | ✅ | ✅ | ✅ | ✅ |
| Auto-Save (Battery/Sleep/Shutdown) | ✅ | ❌ | ❌ | ❌ |
| Tab Group Support | Full | ❌ | Partial | ❌ |
| Side Panel UI | ✅ | ❌ | ❌ | ❌ |
| Modern UI (2026 Design) | ✅ | ❌ | ❌ | ❌ |
| Import / Export | JSON + HTML + MD + CSV | URL List | JSON | JSON |
| Manifest V3 | ✅ | Migrating | ✅ | Migrating |
| Search Sessions | Full-text | ❌ | Basic | Basic |
| Keyboard Shortcuts | Customizable | Limited | Limited | Limited |
| Freemium Model | ✅ | ❌ | ❌ | ❌ |

---

## 3. User Personas & Use Cases

### 3.1 Personas

**Persona 1: Sarah — Full-Stack Developer**
- Opens 30-50 tabs daily across multiple projects
- Needs to switch contexts between frontend, backend, and DevOps tasks
- Frequently loses tabs during system updates and restarts
- Wants keyboard-driven workflow with Side Panel always accessible

**Persona 2: Omar — Graduate Researcher**
- Maintains research sessions with 50+ academic paper tabs
- Organizes tabs into groups by topic (ML, NLP, Datasets, etc.)
- Laptop battery dies frequently at the library
- Needs to export session links to share with advisor

**Persona 3: Lisa — Marketing Manager**
- Manages multiple client campaigns in separate tab groups
- Switches between client workspaces multiple times per day
- Wants visual, intuitive interface without technical complexity
- Needs to share curated tab collections with team members

### 3.2 Core Use Cases

| ID | Use Case | Actor | Priority |
|---|---|---|---|
| UC-01 | Save all current tabs with one click | All Users | 🔴 Critical |
| UC-02 | Auto-save before shutdown/sleep/low battery | All Users | 🔴 Critical |
| UC-03 | Restore a saved session fully or selectively | All Users | 🔴 Critical |
| UC-04 | Save and restore Chrome tab groups with colors and names | Power Users | 🟠 High |
| UC-05 | Name, tag, and organize saved sessions | All Users | 🟠 High |
| UC-06 | Search across all saved sessions | Power Users | 🟠 High |
| UC-07 | Export sessions as JSON or HTML bookmark file | All Users | 🟠 High |
| UC-08 | Import sessions from JSON or another browser | All Users | 🟡 Medium |
| UC-09 | Pin frequently used sessions for quick access | All Users | 🟡 Medium |
| UC-10 | Keyboard shortcut to save/restore instantly | Power Users | 🟡 Medium |
| UC-11 | View session history and diffs | Power Users | 🔵 Low |
| UC-12 | Sync sessions across devices (Pro) | Pro Users | 🔵 Low |
| UC-13 | Manage sessions from the Side Panel while browsing | All Users | 🔴 Critical |

---

## 4. Functional Requirements

### 4.1 One-Click Session Save

| Req ID | Requirement | Priority |
|---|---|---|
| FR-001 | Save all tabs from the current window with one click on the extension icon or Side Panel button | 🔴 Critical |
| FR-002 | Save all tabs from ALL open windows simultaneously | 🟠 High |
| FR-003 | Capture full tab metadata: URL, title, favicon, scroll position, pinned state | 🔴 Critical |
| FR-004 | Auto-generate session name with timestamp (e.g., "Session — Mar 14, 2026 3:45 PM") | 🟠 High |
| FR-005 | Allow custom naming before or after saving | 🟠 High |
| FR-006 | Show save confirmation toast notification in the Side Panel | 🟡 Medium |
| FR-007 | Optionally close tabs after saving (configurable) | 🟡 Medium |
| FR-008 | Duplicate detection: warn if saving nearly identical session | 🔵 Low |

### 4.2 Session Restore

| Req ID | Requirement | Priority |
|---|---|---|
| FR-009 | Restore a complete session in a new window | 🔴 Critical |
| FR-010 | Restore a session in the current window (replace or append) | 🟠 High |
| FR-011 | Selective restore: choose specific tabs or tab groups to open | 🟠 High |
| FR-012 | Lazy loading: tabs load only when activated to save memory | 🟠 High |
| FR-013 | Restore tab order, pinned state, and group assignments | 🔴 Critical |
| FR-014 | Handle dead URLs gracefully (show placeholder with retry option) | 🟡 Medium |

---

## 5. Auto-Save Engine

The Auto-Save Engine is the core differentiator. It runs as a background service worker and captures session state based on intelligent triggers.

### 5.1 Auto-Save Triggers

| Trigger | Detection Method | API / Event | Priority |
|---|---|---|---|
| Browser Close | Listen for browser shutdown signal | `chrome.runtime.onSuspend` | 🔴 Critical |
| System Sleep/Hibernate | Detect idle state transition to locked | `chrome.idle.onStateChanged` | 🔴 Critical |
| Low Battery | Monitor battery level via Battery Status API | `navigator.getBattery()` | 🔴 Critical |
| Periodic Interval | Timer-based auto-save (user configurable: 5-60 min) | `chrome.alarms` API | 🟠 High |
| Tab Change Threshold | Save when N tabs change since last save | `chrome.tabs.onUpdated` | 🟡 Medium |
| Window Close | Save before any window closes | `chrome.windows.onRemoved` | 🟠 High |
| Network Disconnect | Save when network connection drops | `navigator.onLine` event | 🔵 Low |

### 5.2 Auto-Save Configuration

| Setting | Type | Default | Range |
|---|---|---|---|
| Enable Auto-Save | Toggle | ON | ON / OFF |
| Save Interval | Slider | 15 minutes | 5 — 60 minutes |
| Max Auto-Saves Retained | Number | 50 | 10 — 200 |
| Save on Browser Close | Toggle | ON | ON / OFF |
| Save on Low Battery | Toggle | ON | ON / OFF |
| Low Battery Threshold | Slider | 15% | 5% — 30% |
| Save on Sleep/Hibernate | Toggle | ON | ON / OFF |
| Save on Network Disconnect | Toggle | OFF | ON / OFF |
| Auto-Delete After | Dropdown | 30 days | 7 / 14 / 30 / 90 / Never |

### 5.3 Auto-Save Behavior

- Auto-saves are labeled with prefix `[Auto]` and include the trigger type (e.g., "[Auto — Low Battery] Mar 14, 3:45 PM")
- Auto-saves are stored in a separate category from manual saves to avoid clutter
- Rolling window: oldest auto-saves are purged when max retention limit is reached
- De-duplication: skip saving if session is identical to the most recent auto-save
- Conflict resolution: if multiple triggers fire simultaneously, only one save is performed

---

## 6. Tab Group Management

Session Saver provides first-class support for Chrome's native tab groups, preserving and restoring them with full fidelity.

### 6.1 Tab Group Features

| Req ID | Requirement | Priority |
|---|---|---|
| TG-001 | Save tab group name, color, and collapsed state | 🔴 Critical |
| TG-002 | Restore tab groups with original colors and names | 🔴 Critical |
| TG-003 | Save/restore individual tab groups independently | 🟠 High |
| TG-004 | Merge tab groups from different sessions | 🟡 Medium |
| TG-005 | Create new tab groups from selected tabs across sessions | 🟡 Medium |
| TG-006 | Display tab group visual preview with color coding in Side Panel | 🟠 High |
| TG-007 | Support ungrouped tabs alongside grouped tabs | 🔴 Critical |
| TG-008 | Preserve tab order within and between groups | 🟠 High |

### 6.2 Tab Group Data Model

Each saved tab group stores the following metadata:

- **Group ID** — internal unique identifier
- **Group Title** — user-defined name
- **Color** — one of Chrome's 9 group colors: grey, blue, red, yellow, green, pink, purple, cyan, orange
- **Collapsed State** — boolean
- **Tab Array** — ordered list of tabs belonging to this group
- **Window ID** — reference to which window the group belongs to

---

## 7. Session Management

### 7.1 Session Organization

| Feature | Description | Priority |
|---|---|---|
| Session Naming | Custom names with auto-suggest based on top domains | 🟠 High |
| Session Tagging | Add custom tags for filtering (e.g., "work", "research", "client-A") | 🟡 Medium |
| Session Pinning | Pin important sessions to the top of the list | 🟡 Medium |
| Session Folders | Organize sessions into folders/categories | 🔵 Low |
| Session Notes | Add text notes or descriptions to any session | 🟡 Medium |
| Session Starring | Mark favorite sessions with a star for quick access | 🟡 Medium |
| Session Locking | Lock sessions to prevent accidental deletion | 🟡 Medium |

### 7.2 Session Search & Filter

- Full-text search across session names, tags, URLs, and page titles
- Filter by: date range, tag, manual vs. auto-save, pinned, starred
- Sort by: date created, date modified, name, tab count
- Search results highlight matching terms
- Real-time search with debounced input (300ms)

### 7.3 Session Actions

- Rename session
- Duplicate session
- Edit session (add/remove individual tabs)
- Merge two or more sessions
- Delete session (with undo for 10 seconds)
- Bulk actions: select multiple sessions for delete, export, merge, or tag
- Session diff: compare two sessions to see added/removed tabs

---

## 8. Import / Export System

### 8.1 Export Formats

| Format | Contents | Use Case |
|---|---|---|
| JSON | Full session data with all metadata, groups, and settings | Backup, migration, restore on another device |
| HTML Bookmarks | Standard Netscape bookmark format compatible with all browsers | Share sessions as bookmarks, import into other browsers |
| Markdown | Formatted list of tabs organized by groups | Documentation, sharing in notes or README files |
| CSV | Tabular format with URL, title, group, and timestamp columns | Data analysis, spreadsheet import |
| Plain Text | Simple URL list, one per line | Quick sharing, command-line tools |

### 8.2 Import Sources

- Import from Session Saver JSON backup files
- Import from Chrome bookmarks HTML file
- Import from other session managers (OneTab format, Session Buddy JSON)
- Import from plain URL list (text file with one URL per line)
- Drag-and-drop import support in the Side Panel and Dashboard

### 8.3 Import / Export Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| IE-001 | Export single session or bulk export multiple sessions | 🟠 High |
| IE-002 | Export all sessions as a complete backup | 🟠 High |
| IE-003 | Import with conflict resolution (skip, overwrite, rename) | 🟡 Medium |
| IE-004 | Validate imported data before applying | 🟠 High |
| IE-005 | Show import preview with tab/session count before confirming | 🟡 Medium |
| IE-006 | Support drag-and-drop for import files | 🔵 Low |
| IE-007 | Include export timestamp and version for compatibility checks | 🟡 Medium |

---

## 9. User Interface & Design

### 9.1 Design Principles

1. **Speed First** — every interaction must feel instant (< 100ms UI response)
2. **One-Click Philosophy** — primary actions require a single click
3. **Side Panel Native** — designed for the Side Panel's vertical, always-visible layout
4. **Progressive Disclosure** — show essential features first, reveal advanced options on demand
5. **Dark & Light Mode** — full theme support respecting system preferences
6. **Accessibility** — WCAG 2.1 AA compliance, full keyboard navigation, screen reader support
7. **Micro-Interactions** — subtle animations for save, restore, delete, and state transitions

### 9.2 UI Surfaces

Session Saver uses **three** UI surfaces, with the Side Panel as the primary interface:

| Surface | Role | Access |
|---|---|---|
| **Side Panel** (Primary) | Main session management interface, always accessible alongside browsing | Click extension icon or `Ctrl+Shift+S` |
| **Extension Popup** (Secondary) | Quick-action fallback for users who prefer popups; shows save button + recent sessions | Click extension icon (configurable) |
| **Full-Page Dashboard** | Advanced management: bulk operations, settings, import/export, analytics | Side Panel link or `chrome-extension://[id]/dashboard.html` |

### 9.3 Keyboard Shortcuts

| Shortcut | Action | Customizable |
|---|---|---|
| `Ctrl+Shift+S` | Toggle Side Panel / Save current session | Yes |
| `Ctrl+Shift+R` | Open restore menu in Side Panel | Yes |
| `Ctrl+Shift+D` | Open full-page dashboard | Yes |
| `Ctrl+Shift+F` | Focus search in Side Panel | Yes |
| `Ctrl+Shift+E` | Quick export last session | Yes |

### 9.4 Visual Design Specifications

| Element | Specification |
|---|---|
| Font Family | Inter (primary), system-ui fallback |
| Border Radius | 8px (cards), 6px (buttons), 12px (modals) |
| Shadow (Cards) | `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)` |
| Shadow (Hover) | `0 4px 12px rgba(0,0,0,0.15)` |
| Primary Color | `#1A73E8` (Blue) |
| Success Color | `#34A853` (Green) |
| Warning Color | `#FBBC04` (Amber) |
| Error Color | `#EA4335` (Red) |
| Transition | `all 150ms cubic-bezier(0.4, 0, 0.2, 1)` |
| Icon System | Lucide Icons (consistent, lightweight, MIT licensed) |

---

## 10. Side Panel Architecture

The Side Panel is the **primary UI surface** for Session Saver, using Chrome's `chrome.sidePanel` API to provide a persistent, always-accessible session management interface docked to the right side of the browser.

### 10.1 Why Side Panel

| Advantage | Description |
|---|---|
| **Persistent Visibility** | Stays open while the user browses, unlike popups that close on any outside click |
| **Full Height** | Uses the entire browser height, providing far more space than popup's 600px limit |
| **Contextual** | Users can see their tabs and sessions side-by-side with their browsing content |
| **Native Feel** | Integrated into Chrome's UI chrome, feels like a built-in feature |
| **No Focus Loss** | Interacting with the Side Panel does not switch focus from the current page |
| **Resizable** | Users can drag the panel edge to adjust width |

### 10.2 Side Panel Configuration

```jsonc
// manifest.json
{
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "permissions": ["sidePanel"]
}
```

### 10.3 Side Panel Behavior

| Behavior | Implementation |
|---|---|
| **Open Trigger** | Clicking the extension toolbar icon opens/toggles the Side Panel |
| **Programmatic Open** | `chrome.sidePanel.open({ windowId })` from service worker on keyboard shortcut |
| **Per-Window State** | Each Chrome window has its own Side Panel instance with independent state |
| **Global Panel** | Side Panel is available on all tabs (not tab-specific) using `chrome.sidePanel.setOptions({ enabled: true })` |
| **Close Behavior** | Panel state is preserved in memory; reopening restores scroll position and view |
| **Width** | Default 360px, user-resizable, min 300px — max 50% of window width |

### 10.4 Side Panel UI Layout

The Side Panel is organized into a vertical layout optimized for the narrow, full-height form factor:

**Section 1 — Header (Fixed Top)**
- Extension logo + name (compact)
- Auto-save status indicator (green dot = active, amber = paused)
- Theme toggle (sun/moon icon)
- Settings gear icon → opens Settings view inline

**Section 2 — Quick Action Bar (Fixed)**
- Large primary button: "💾 Save Session" (full width)
- Secondary row: "Save & Close" button + "Save All Windows" button
- Current session info badge: "12 tabs · 3 groups"

**Section 3 — Search & Filter (Sticky)**
- Search input with magnifier icon
- Filter chip row: All | Manual | Auto | Starred | Pinned
- Sort dropdown: Date ↓ | Name | Tabs

**Section 4 — Session List (Scrollable)**
- Scrollable list of Session Cards
- Virtual scrolling for performance with 500+ sessions
- Pull-to-refresh gesture on mobile/touchscreen

**Session Card Design:**
```
┌──────────────────────────────────┐
│ ⭐ Work — Frontend Sprint        │
│ Mar 14, 2026 · 15 tabs          │
│ ● Red  ● Blue  ● Green  (groups)│
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ [Restore] [⋮ More]              │
└──────────────────────────────────┘
```

- Session name (bold, truncated with tooltip)
- Timestamp + tab count
- Tab group color dots preview
- Quick restore button + overflow menu (edit, rename, delete, export, pin, lock)
- Swipe-left to delete (with undo toast)

**Section 5 — Footer (Fixed Bottom)**
- "Open Dashboard" link
- Storage usage indicator: "2.3 MB / 50 MB"
- Keyboard shortcuts hint icon

### 10.5 Side Panel Views (In-Panel Navigation)

The Side Panel supports multiple views with smooth transitions, all rendered within the panel:

| View | Description | Access |
|---|---|---|
| **Home** | Default view with quick actions + session list | Panel open |
| **Session Detail** | Expand a session to see all tabs, groups, and metadata | Click a session card |
| **Tab Groups** | Browse and manage saved tab groups across sessions | Bottom nav or filter |
| **Settings** | Auto-save config, shortcuts, theme, import/export triggers | Gear icon |
| **Import/Export** | File picker, format selection, drag-and-drop zone | Settings → Import/Export |

Navigation uses a back-button stack (← arrow in header) with animated slide transitions.

### 10.6 Side Panel + Popup Coexistence

| Scenario | Behavior |
|---|---|
| User clicks extension icon | Opens/toggles the Side Panel (default) |
| User right-clicks icon → "Open Popup" | Opens traditional popup for quick save |
| User sets preference to "Popup Mode" | Extension icon opens popup; Side Panel via shortcut only |
| Side Panel is open + user clicks icon | Closes the Side Panel (toggle behavior) |

The user can choose their preferred primary UI in settings:

```
Settings → Interface → Primary UI:
  ○ Side Panel (recommended)
  ○ Popup
```

### 10.7 Side Panel Technical Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| SP-001 | Side Panel opens via toolbar icon click using `chrome.sidePanel.open()` | 🔴 Critical |
| SP-002 | Side Panel is available globally on all tabs (not tab-specific) | 🔴 Critical |
| SP-003 | Side Panel state persists when switching tabs (scroll position, active view) | 🟠 High |
| SP-004 | Side Panel loads in < 150ms (lightweight initial bundle) | 🟠 High |
| SP-005 | Side Panel communicates with service worker via `chrome.runtime.sendMessage` | 🔴 Critical |
| SP-006 | Side Panel supports full keyboard navigation within panel | 🟠 High |
| SP-007 | Side Panel respects system dark/light mode and allows manual toggle | 🟠 High |
| SP-008 | Side Panel renders correctly at minimum width of 300px | 🟠 High |
| SP-009 | Virtual scrolling for session list with 500+ items | 🟡 Medium |
| SP-010 | Side Panel includes drag-and-drop zone for file import | 🔵 Low |

---

## 11. Technical Architecture

### 11.1 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Extension Platform | Chrome Manifest V3 | Required for Chrome Web Store, uses service workers |
| Primary UI Surface | Chrome Side Panel API | Persistent, full-height panel docked to browser |
| Frontend Framework | React 18+ with TypeScript | Component-based, type-safe, large ecosystem |
| State Management | Zustand | Lightweight, TypeScript-native, no boilerplate |
| Styling | Tailwind CSS + CSS Modules | Utility-first, dark mode support, scoped styles |
| Build Tool | Vite + CRXJS Plugin | Fast builds, HMR for extensions, Manifest V3 support |
| Storage | chrome.storage.local + IndexedDB | Local for settings, IndexedDB for large session data |
| Testing | Vitest + Testing Library + Playwright | Unit, integration, and E2E testing |
| Linting | ESLint + Prettier + Husky | Code quality and consistency enforcement |
| Icons | Lucide React | Consistent, tree-shakable, MIT licensed |
| Animation | Framer Motion | Performant micro-interactions and page transitions |
| Virtual Scrolling | @tanstack/react-virtual | Performant rendering for large session lists |

### 11.2 Architecture Overview

Session Saver follows a layered architecture pattern optimized for Chrome extension development with clear separation of concerns.

**Layer 1 — Background Service Worker:** Handles all Chrome API interactions, auto-save engine, event listeners, alarm management, and Side Panel lifecycle control.

**Layer 2 — Storage Layer:** Abstracted storage interface supporting `chrome.storage.local` for settings and IndexedDB for session data, with a unified API.

**Layer 3 — Core Business Logic:** Session CRUD operations, tab group management, import/export processors, search indexing. Framework-agnostic, fully testable.

**Layer 4 — UI Layer:** React components for Side Panel, popup, and dashboard. Zustand stores and presentation logic. Shared component library across all surfaces.

### 11.3 Data Models

Core TypeScript interfaces that define the application data structure:

**Session Interface:**
- `id: string` — UUID v4
- `name: string`
- `createdAt: string` — ISO 8601 timestamp
- `updatedAt: string` — ISO 8601 timestamp
- `tabs: Tab[]` — array of tab objects
- `tabGroups: TabGroup[]` — array of tab group objects
- `windowId: number` — source window
- `tags: string[]`
- `isPinned: boolean`
- `isStarred: boolean`
- `isLocked: boolean`
- `isAutoSave: boolean`
- `autoSaveTrigger: 'timer' | 'shutdown' | 'sleep' | 'battery' | 'network' | 'manual'`
- `notes: string`
- `tabCount: number`
- `version: string` — schema version for migrations

**Tab Interface:**
- `id: string`
- `url: string`
- `title: string`
- `favIconUrl: string`
- `index: number` — position in window
- `pinned: boolean`
- `groupId: number` — (-1 if ungrouped)
- `active: boolean`
- `scrollPosition: { x: number, y: number }`

**TabGroup Interface:**
- `id: number`
- `title: string`
- `color: ChromeGroupColor` — enum
- `collapsed: boolean`
- `tabIds: string[]`

### 11.4 Message Protocol (Service Worker ↔ Side Panel)

Communication between the Side Panel and the background service worker uses `chrome.runtime.sendMessage` with typed message contracts:

```typescript
type MessageType =
  | { action: 'SAVE_SESSION'; payload: { windowId?: number; name?: string; closeAfter?: boolean } }
  | { action: 'RESTORE_SESSION'; payload: { sessionId: string; mode: 'new_window' | 'current' | 'append' } }
  | { action: 'DELETE_SESSION'; payload: { sessionId: string } }
  | { action: 'GET_SESSIONS'; payload: { filter?: SessionFilter; sort?: SessionSort } }
  | { action: 'GET_CURRENT_TABS'; payload: {} }
  | { action: 'EXPORT_SESSIONS'; payload: { sessionIds: string[]; format: ExportFormat } }
  | { action: 'IMPORT_SESSIONS'; payload: { data: string; source: ImportSource } }
  | { action: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { action: 'AUTO_SAVE_STATUS'; payload: {} }
```

---

## 12. Project Structure

The project follows a feature-based modular architecture designed for maintainability and extensibility.

### 12.1 Directory Layout

```
session-saver/
├── public/
│   ├── icons/                        # Extension icons (16, 32, 48, 128px)
│   └── manifest.json                 # Chrome Manifest V3 configuration
├── src/
│   ├── background/
│   │   ├── index.ts                  # Service worker entry point
│   │   ├── auto-save-engine.ts       # Auto-save trigger management
│   │   ├── event-listeners.ts        # Chrome event handlers
│   │   ├── side-panel-controller.ts  # Side Panel open/close/toggle logic
│   │   └── alarms.ts                 # Chrome alarms for periodic saves
│   ├── core/
│   │   ├── types/
│   │   │   ├── session.types.ts      # Session, Tab, TabGroup interfaces
│   │   │   ├── settings.types.ts     # Settings & configuration types
│   │   │   ├── messages.types.ts     # Message protocol types (SW ↔ UI)
│   │   │   └── storage.types.ts      # Storage layer types
│   │   ├── services/
│   │   │   ├── session.service.ts    # Session CRUD operations
│   │   │   ├── tab-group.service.ts  # Tab group management logic
│   │   │   ├── search.service.ts     # Full-text search indexing
│   │   │   ├── export.service.ts     # Export processors (JSON, HTML, MD, CSV)
│   │   │   ├── import.service.ts     # Import processors & validators
│   │   │   └── migration.service.ts  # Data schema migrations
│   │   ├── storage/
│   │   │   ├── storage.interface.ts  # Abstract storage interface
│   │   │   ├── chrome-storage.ts     # chrome.storage.local adapter
│   │   │   ├── indexeddb.ts          # IndexedDB adapter for session data
│   │   │   └── storage-factory.ts    # Storage provider factory
│   │   └── utils/
│   │       ├── uuid.ts               # UUID generation
│   │       ├── date.ts               # Date formatting utilities
│   │       ├── validators.ts         # Data validation helpers
│   │       └── debounce.ts           # Debounce/throttle utilities
│   ├── sidepanel/
│   │   ├── App.tsx                   # Side Panel root component
│   │   ├── index.tsx                 # Side Panel entry point
│   │   ├── index.html                # Side Panel HTML shell
│   │   ├── views/
│   │   │   ├── HomeView.tsx          # Default: quick actions + session list
│   │   │   ├── SessionDetailView.tsx # Expanded session with all tabs
│   │   │   ├── TabGroupsView.tsx     # Tab group browser
│   │   │   ├── SettingsView.tsx      # Auto-save config, theme, shortcuts
│   │   │   └── ImportExportView.tsx  # Import/export interface
│   │   ├── components/
│   │   │   ├── Header.tsx            # Logo, auto-save badge, theme, settings
│   │   │   ├── QuickActions.tsx      # Save / Save+Close / Save All Windows
│   │   │   ├── SessionList.tsx       # Virtual-scrolled session list
│   │   │   ├── SessionCard.tsx       # Individual session preview card
│   │   │   ├── SearchBar.tsx         # Search with filter chips
│   │   │   ├── TabGroupPreview.tsx   # Color dot row for tab groups
│   │   │   ├── AutoSaveBadge.tsx     # Green/amber status dot
│   │   │   └── NavigationStack.tsx   # Back-button view navigation
│   │   └── stores/
│   │       └── sidepanel.store.ts    # Zustand store for Side Panel state
│   ├── popup/
│   │   ├── App.tsx                   # Popup root (minimal quick-action UI)
│   │   ├── index.tsx                 # Popup entry point
│   │   └── index.html                # Popup HTML shell
│   ├── dashboard/
│   │   ├── App.tsx                   # Dashboard root component
│   │   ├── index.tsx                 # Dashboard entry point
│   │   ├── index.html                # Dashboard HTML shell
│   │   ├── pages/
│   │   │   ├── SessionsPage.tsx      # Session list/grid with management
│   │   │   ├── AutoSavesPage.tsx     # Auto-save history view
│   │   │   ├── TabGroupsPage.tsx     # Tab group browser
│   │   │   ├── ImportExportPage.tsx  # Import/export interface
│   │   │   └── SettingsPage.tsx      # Full settings panel
│   │   ├── components/
│   │   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   │   ├── SessionDetail.tsx     # Session detail panel
│   │   │   ├── BulkToolbar.tsx       # Bulk action toolbar
│   │   │   └── StatsWidget.tsx       # Usage statistics
│   │   └── stores/
│   │       └── dashboard.store.ts    # Zustand store for dashboard
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ContextMenu.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── hooks/
│   │   │   ├── useSession.ts         # Session operations hook
│   │   │   ├── useAutoSave.ts        # Auto-save status hook
│   │   │   ├── useSearch.ts          # Search hook
│   │   │   ├── useKeyboard.ts        # Keyboard shortcut hook
│   │   │   ├── useTheme.ts           # Theme management hook
│   │   │   └── useMessaging.ts       # SW ↔ UI message hook
│   │   └── styles/
│   │       ├── globals.css           # Tailwind base + custom properties
│   │       └── themes.css            # Light/dark theme variables
│   └── content/
│       └── scroll-capture.ts         # Content script for scroll position
├── tests/
│   ├── unit/                         # Vitest unit tests
│   ├── integration/                  # Integration tests
│   └── e2e/                          # Playwright E2E tests
├── _locales/                         # i18n message files
│   ├── en/messages.json
│   └── ar/messages.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── README.md
```

### 12.2 Key Architecture Decisions

- **Side Panel as primary UI:** Designed from the ground up for the vertical, always-visible Side Panel layout; popup is a stripped-down fallback
- **Feature-based structure:** Each UI surface (sidepanel, popup, dashboard) is self-contained with its own components, stores, and views
- **Core layer is framework-agnostic:** Services and storage can be tested without React or browser APIs
- **Shared components** ensure UI consistency across all three surfaces
- **Storage abstraction** allows swapping between `chrome.storage` and IndexedDB without changing business logic
- **TypeScript strict mode** throughout for maximum type safety
- **Typed message protocol** between service worker and UI prevents runtime communication errors
- **Each service has a single responsibility** and exposes a clean API

---

## 13. Chrome Web Store Requirements

### 13.1 Manifest V3 Compliance

| Requirement | Status | Notes |
|---|---|---|
| Service Worker (no background pages) | Required | Background scripts must use service worker pattern |
| Side Panel declaration | Required | `"side_panel"` key in manifest.json |
| Declarative Net Request (if needed) | N/A | Session Saver does not modify network requests |
| Permissions: minimal scope | Required | Only request permissions actually used |
| Content Security Policy | Required | No inline scripts, strict CSP in manifest |
| Remote code prohibition | Required | All code bundled locally, no remote script loading |

### 13.2 Required Permissions

| Permission | Type | Justification |
|---|---|---|
| `tabs` | Required | Read tab URLs, titles, and state for saving sessions |
| `tabGroups` | Required | Read and create tab groups during save/restore |
| `storage` | Required | Persist sessions and settings locally |
| `alarms` | Required | Schedule periodic auto-save intervals |
| `idle` | Required | Detect system idle/sleep for auto-save triggers |
| `sidePanel` | Required | Register and control the Side Panel UI |
| `activeTab` | Required | Access active tab for scroll position capture |
| `system.display` | Optional | Detect sleep events on some platforms |

### 13.3 Manifest V3 Side Panel Declaration

```json
{
  "manifest_version": 3,
  "name": "Session Saver",
  "version": "1.0.0",
  "description": "Save, restore, and manage your browser sessions with one click. Auto-save protects your tabs before shutdown, sleep, or low battery.",
  "permissions": [
    "tabs",
    "tabGroups",
    "storage",
    "alarms",
    "idle",
    "sidePanel",
    "activeTab"
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    "default_title": "Session Saver"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Ctrl+Shift+S" },
      "description": "Toggle Session Saver Side Panel"
    }
  }
}
```

### 13.4 Store Listing Assets

| Asset | Specification |
|---|---|
| Extension Icon | 128x128 PNG with transparent background |
| Promotional Tile (Small) | 440x280 PNG |
| Promotional Tile (Large) | 920x680 PNG |
| Screenshots | 1280x800 or 640x400 PNG (min 1, max 5) |
| Description | Up to 132 characters (short), full description up to 16,000 chars |
| Category | Productivity |
| Language | English (primary), with i18n support for additional locales |
| Privacy Policy URL | Required (hosted on project website or GitHub Pages) |

---

## 14. Non-Functional Requirements

### 14.1 Performance

| Metric | Target | Measurement |
|---|---|---|
| Side Panel Load Time | < 150ms | Time from icon click to interactive UI |
| Popup Load Time | < 200ms | Time from click to interactive UI |
| Session Save (100 tabs) | < 500ms | Time from click to save confirmation |
| Session Restore (100 tabs) | < 2s | Time from click to all tabs created |
| Search Response | < 100ms | Time from keystroke to filtered results |
| Storage Footprint | < 50MB | Total storage for 500 sessions |
| Memory Usage (Idle) | < 5MB | Service worker memory when not actively saving |
| Side Panel Memory | < 15MB | Side Panel React app idle memory |
| Dashboard Load | < 1s | Time to interactive dashboard page |

### 14.2 Security & Privacy

- All session data stored locally on the user's device; no data sent to external servers
- No analytics or tracking without explicit user opt-in
- Exported files contain only session metadata, never cookies or authentication tokens
- Content Security Policy enforced to prevent XSS
- Regular dependency audits via `npm audit`

### 14.3 Accessibility

- WCAG 2.1 AA compliance for all UI components
- Full keyboard navigation with visible focus indicators
- Screen reader support with ARIA labels on all interactive elements
- Color contrast ratio minimum 4.5:1 for text, 3:1 for large text
- Reduced motion support via `prefers-reduced-motion` media query
- Side Panel supports full Tab/Shift+Tab navigation between sections

### 14.4 Internationalization

- All user-facing strings extracted to i18n message files (`chrome.i18n` API)
- RTL layout support for Arabic, Hebrew, and other RTL languages
- Initial launch: English, Arabic, Spanish, French, German, Japanese, Chinese (Simplified)
- Date and number formatting respects user locale

---

## 15. Analytics & Metrics

All analytics are opt-in and privacy-respecting. No personally identifiable information is collected.

### 15.1 Key Performance Indicators (KPIs)

| KPI | Target | Measurement Period |
|---|---|---|
| Chrome Web Store Rating | >= 4.5 stars | Rolling 90 days |
| Weekly Active Users | 10,000+ | After 6 months |
| Session Save Success Rate | >= 99.5% | Rolling 30 days |
| Crash-Free Sessions | >= 99.9% | Rolling 30 days |
| Average Save Time (100 tabs) | < 500ms | Rolling 7 days |
| User Retention (30-day) | >= 60% | Monthly cohort |
| Pro Conversion Rate | >= 3% | Monthly |
| Side Panel Usage Ratio | >= 70% | % of users preferring Side Panel over popup |

### 15.2 Tracked Events (Opt-In Only)

- `session_saved` — manual vs. auto, trigger type, tab count
- `session_restored` — full vs. selective, tab count
- `export_completed` — format type
- `import_completed` — source type, session count
- `auto_save_triggered` — trigger type
- `ui_surface_used` — sidepanel vs. popup vs. dashboard
- `error_occurred` — error type, component, anonymized stack trace

---

## 16. Release Roadmap

### 16.1 Phase 1: MVP (v1.0) — 8 Weeks

Core functionality for Chrome Web Store launch.

| Week | Milestone | Deliverables |
|---|---|---|
| 1-2 | Project Setup & Core Architecture | Vite + React + TS scaffolding, storage layer, data models, CI/CD pipeline, Side Panel shell |
| 3-4 | Session Save & Restore | One-click save, full restore, selective restore, tab metadata capture |
| 5 | Auto-Save Engine | Service worker triggers, battery/sleep/shutdown detection, alarm-based periodic saves |
| 6 | Tab Group Support | Save/restore tab groups with colors and names, group-level operations |
| 7 | UI Polish & Import/Export | Side Panel + popup + dashboard UI, JSON/HTML export, JSON import, dark mode |
| 8 | Testing & Store Submission | E2E tests, performance audit, store listing assets, submission |

### 16.2 Phase 2: Enhanced (v1.5) — 6 Weeks

- Session search with full-text indexing
- Session tagging, pinning, and starring
- Bulk operations (multi-select delete, export, merge)
- Additional export formats (Markdown, CSV, plain text)
- Keyboard shortcut customization
- Import from other session managers (OneTab, Session Buddy)
- Side Panel drag-and-drop import

### 16.3 Phase 3: Pro (v2.0) — 8 Weeks

- Cloud sync across devices (optional, encrypted)
- Session sharing via link
- Session templates (pre-defined tab collections for common workflows)
- Session scheduling (auto-open sessions at specific times)
- Advanced analytics dashboard
- Team/workspace features for shared session libraries

---

## 17. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chrome API changes break auto-save triggers | Medium | High | Abstract all Chrome APIs behind interfaces; monitor Chromium changelogs |
| `chrome.sidePanel` API changes or deprecation | Low | Critical | Maintain popup as fallback UI; abstract UI surface behind routing layer |
| Large session data exceeds storage limits | Medium | Medium | Implement data compression; use IndexedDB for overflow; add storage usage warnings |
| Service worker terminated during save | Low | High | Implement atomic save operations with rollback; use `chrome.alarms` as heartbeat |
| Manifest V3 restrictions limit functionality | Low | Medium | Design within MV3 constraints from day one; no reliance on MV2-only features |
| Store rejection due to permission scope | Low | High | Request minimal permissions; justify each in submission; phased permission requests |
| Poor performance with 200+ tabs | Medium | Medium | Lazy rendering, virtual scrolling, batched storage operations, performance budget |

---

## 18. Future Enhancements

The following features are planned for consideration in future releases beyond v2.0, based on user feedback and market demand.

- Firefox and Edge extension ports (WebExtension API compatibility layer)
- AI-powered session suggestions (auto-group tabs by topic using ML classification)
- Session snapshots with visual thumbnails of each tab
- Integration with project management tools (Notion, Linear, Jira) to create tasks from sessions
- Collaborative sessions for pair programming and remote collaboration
- Session analytics: track time spent in sessions, most visited domains, tab lifecycle data
- Automatic tab deduplication across windows and sessions
- REST API for power users to manage sessions programmatically
- Mobile companion app for viewing saved sessions on phone/tablet
- Custom automation rules (e.g., auto-save when visiting specific domains, auto-group by domain)
- Side Panel widgets/extensions system for third-party integrations

---

*End of Document — Session Saver PRD v1.0 — March 2026*
