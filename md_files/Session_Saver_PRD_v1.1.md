# SESSION SAVER — Chrome Extension

## Product Requirements Document

**Version:** 1.1  
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
11. [New Tab Page Override](#11-new-tab-page-override)
12. [Technical Architecture](#12-technical-architecture)
13. [Project Structure](#13-project-structure)
14. [Chrome Web Store Requirements](#14-chrome-web-store-requirements)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Analytics & Metrics](#16-analytics--metrics)
17. [Release Roadmap](#17-release-roadmap)
18. [Risk Assessment](#18-risk-assessment)
19. [Future Enhancements](#19-future-enhancements)

---

## 1. Document Overview

### 1.1 Purpose

This Product Requirements Document (PRD) defines the full scope, technical architecture, and feature set for **Session Saver**, a Chrome extension that enables users to save, restore, and manage their browser sessions with a single click. The document serves as the definitive reference for development, design, and quality assurance teams.

### 1.2 Document Info

| Field | Details |
|---|---|
| Product Name | Session Saver |
| Version | 1.1.0 |
| Platform | Google Chrome (Manifest V3) |
| Primary UI | Chrome Side Panel API |
| New Tab Page | Custom New Tab Override |
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
| Side Panel | Chrome's built-in side panel UI surface that docks to the right of the browser |
| New Tab Override | Chrome API that replaces the default new tab page with a custom extension page |
| Glassmorphism | UI design style using frosted glass panels with backdrop blur over rich backgrounds |
| Card Density | User-adjustable spacing for bookmark cards: Compact (tight) or Comfortable (spacious) |
| Layout Mode | New Tab display mode: Minimal (search only), Focus (search + links + to-do), Dashboard (full UI) |
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
- Current extensions use limited popups that feel cramped for session management
- Chrome's default new tab page offers no meaningful bookmark organization or productivity tools

### 2.3 Value Proposition

Session Saver is the fastest, most reliable way to save and restore your complete browsing state. One click saves everything. Smart auto-save protects you before shutdowns, sleep, or low battery. The always-visible Side Panel makes session management effortless. The custom New Tab page transforms every new tab into a glassmorphism command center with organized bookmarks, quick links, and a built-in to-do list.

### 2.4 Target Audience

- Power users who keep 20+ tabs open at any time
- Developers and researchers who context-switch between projects
- Students managing coursework, research, and personal browsing
- Remote workers juggling multiple client workspaces
- Anyone who has ever lost tabs and wished they could get them back
- Users who want a beautiful, organized, and productive new tab experience

### 2.5 Competitive Analysis

| Feature | Session Saver | OneTab | Session Buddy | Tab Session Mgr | ZenStack |
|---|---|---|---|---|---|
| One-Click Save All Tabs | ✅ | ✅ | ✅ | ✅ | ❌ |
| Auto-Save (Battery/Sleep/Shutdown) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tab Group Support | Full | ❌ | Partial | ❌ | ❌ |
| Side Panel UI | ✅ | ❌ | ❌ | ❌ | ❌ |
| Custom New Tab Page | ✅ | ❌ | ❌ | ❌ | ✅ |
| Glassmorphism UI | ✅ | ❌ | ❌ | ❌ | Partial |
| Built-in To-Do List | ✅ | ❌ | ❌ | ❌ | ❌ |
| Layout Modes (Minimal/Focus/Dashboard) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Card Density (Compact/Comfortable) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Import / Export | JSON + HTML + MD + CSV | URL List | JSON | JSON | Limited |
| Manifest V3 | ✅ | Migrating | ✅ | Migrating | ✅ |
| Search Sessions | Full-text | ❌ | Basic | Basic | Basic |
| Keyboard Shortcuts | Customizable | Limited | Limited | Limited | Limited |
| Freemium Model | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## 3. User Personas & Use Cases

### 3.1 Personas

**Persona 1: Sarah — Full-Stack Developer**
- Opens 30-50 tabs daily across multiple projects
- Needs to switch contexts between frontend, backend, and DevOps tasks
- Frequently loses tabs during system updates and restarts
- Wants keyboard-driven workflow with Side Panel always accessible
- Uses Compact density to see more bookmarks at once

**Persona 2: Omar — Graduate Researcher**
- Maintains research sessions with 50+ academic paper tabs
- Organizes tabs into groups by topic (ML, NLP, Datasets, etc.)
- Laptop battery dies frequently at the library
- Needs to export session links to share with advisor
- Organizes bookmarks by research topic on the New Tab page

**Persona 3: Lisa — Marketing Manager**
- Manages multiple client campaigns in separate tab groups
- Switches between client workspaces multiple times per day
- Wants visual, intuitive interface without technical complexity
- Needs to share curated tab collections with team members
- Uses to-do list widget to track daily campaign tasks

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
| UC-14 | Organize bookmarks on a custom New Tab page with boards and categories | All Users | 🔴 Critical |
| UC-15 | Track daily tasks via built-in to-do list on New Tab | All Users | 🟠 High |
| UC-16 | Switch between Minimal, Focus, and Dashboard layouts | All Users | 🟠 High |

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

| Trigger | Detection Method | Chrome API / Event | Priority |
|---|---|---|---|
| Browser Close | Listen for browser shutdown signal | runtime.onSuspend | 🔴 Critical |
| System Sleep/Hibernate | Detect idle state transition to locked | idle.onStateChanged | 🔴 Critical |
| Low Battery | Monitor battery level via Battery Status API | navigator.getBattery() | 🔴 Critical |
| Periodic Interval | Timer-based auto-save (user configurable: 5-60 min) | alarms API | 🟠 High |
| Tab Change Threshold | Save when N tabs change since last save | tabs.onUpdated | 🟡 Medium |
| Window Close | Save before any window closes | windows.onRemoved | 🟠 High |
| Network Disconnect | Save when network connection drops | navigator.onLine event | 🔵 Low |

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

- Auto-saves are labeled with prefix "[Auto]" and include the trigger type (e.g., "[Auto — Low Battery] Mar 14, 3:45 PM")
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

Each saved tab group stores the following metadata: group ID (internal unique identifier), group title (user-defined name), color (one of Chrome's 9 group colors: grey, blue, red, yellow, green, pink, purple, cyan, orange), collapsed state (boolean), tab array (ordered list of tabs belonging to this group), and window ID reference (which window the group belongs to).

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
- Drag-and-drop import support in the Side Panel, New Tab page, and Dashboard

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
4. **Glassmorphism Language** — frosted glass panels over rich wallpaper backgrounds on New Tab page
5. **Progressive Disclosure** — show essential features first, reveal advanced options on demand
6. **Dark & Light Mode** — full theme support respecting system preferences, with Auto mode
7. **Accessibility** — WCAG 2.1 AA compliance, full keyboard navigation, screen reader support
8. **Micro-Interactions** — subtle animations for save, restore, delete, and state transitions

### 9.2 UI Surfaces

Session Saver uses **four** UI surfaces:

| Surface | Role | Access |
|---|---|---|
| **Side Panel** (Primary) | Main session management interface, always accessible alongside browsing | Click extension icon or Ctrl+Shift+S |
| **New Tab Page** | Glassmorphism command center: bookmarks, quick links, to-do list, session widget | Open a new tab (Ctrl+T) |
| **Extension Popup** (Secondary) | Quick-action fallback for users who prefer popups; shows save button + recent sessions | Click extension icon (configurable) |
| **Full-Page Dashboard** | Advanced management: bulk operations, settings, import/export, analytics | Side Panel link or direct URL |

### 9.3 Keyboard Shortcuts

| Shortcut | Action | Customizable |
|---|---|---|
| Ctrl+Shift+S | Toggle Side Panel / Save current session | Yes |
| Ctrl+Shift+R | Open restore menu in Side Panel | Yes |
| Ctrl+Shift+D | Open full-page dashboard | Yes |
| Ctrl+Shift+F | Focus search in Side Panel | Yes |
| Ctrl+Shift+E | Quick export last session | Yes |

### 9.4 Visual Design Specifications

| Element | Specification |
|---|---|
| Font Family | Inter (primary), system-ui fallback |
| Border Radius | 8px (cards), 6px (buttons), 12px (modals), 16px (glass panels), 24px (search bar pill) |
| Shadow (Cards) | Subtle 8px spread with 12% opacity |
| Shadow (Hover) | Medium 12px spread with 15% opacity, 1px upward lift |
| Primary Color | #1A73E8 (Blue) |
| Success Color | #34A853 (Green) |
| Warning Color | #FBBC04 (Amber) |
| Error Color | #EA4335 (Red) |
| Transition | 150ms cubic-bezier(0.4, 0, 0.2, 1) for interactions, 300ms for theme crossfade |
| Icon System | Lucide Icons (consistent, lightweight, MIT licensed) |

---

## 10. Side Panel Architecture

The Side Panel is the **primary UI surface** for Session Saver, using Chrome's Side Panel API to provide a persistent, always-accessible session management interface docked to the right side of the browser.

### 10.1 Why Side Panel

| Advantage | Description |
|---|---|
| **Persistent Visibility** | Stays open while the user browses, unlike popups that close on any outside click |
| **Full Height** | Uses the entire browser height, providing far more space than popup's 600px limit |
| **Contextual** | Users can see their tabs and sessions side-by-side with their browsing content |
| **Native Feel** | Integrated into Chrome's UI chrome, feels like a built-in feature |
| **No Focus Loss** | Interacting with the Side Panel does not switch focus from the current page |
| **Resizable** | Users can drag the panel edge to adjust width |

### 10.2 Side Panel Behavior

| Behavior | Description |
|---|---|
| **Open Trigger** | Clicking the extension toolbar icon opens/toggles the Side Panel |
| **Programmatic Open** | Service worker can open the panel on keyboard shortcut |
| **Per-Window State** | Each Chrome window has its own Side Panel instance with independent state |
| **Global Panel** | Side Panel is available on all tabs (not tab-specific) |
| **Close Behavior** | Panel state is preserved in memory; reopening restores scroll position and view |
| **Width** | Default 360px, user-resizable, min 300px — max 50% of window width |

### 10.3 Side Panel UI Layout

The Side Panel is organized into a vertical layout optimized for the narrow, full-height form factor:

**Section 1 — Header (Fixed Top):** Extension logo and name (compact), auto-save status indicator (green dot = active, amber = paused), theme toggle (sun/moon icon), settings gear icon that opens Settings view inline.

**Section 2 — Quick Action Bar (Fixed):** Large primary "Save Session" button (full width), secondary row with "Save & Close" and "Save All Windows" buttons, current session info badge showing tab and group count.

**Section 3 — Search & Filter (Sticky):** Search input with magnifier icon, filter chip row (All, Manual, Auto, Starred, Pinned), sort dropdown (Date, Name, Tabs).

**Section 4 — Session List (Scrollable):** Scrollable list of Session Cards with virtual scrolling for 500+ sessions. Each Session Card shows: session name (bold, truncated with tooltip), timestamp and tab count, tab group color dots preview, quick restore button and overflow menu (edit, rename, delete, export, pin, lock), swipe-left to delete with undo toast.

**Section 5 — Footer (Fixed Bottom):** "Open Dashboard" link, storage usage indicator, keyboard shortcuts hint icon.

### 10.4 Side Panel Views

The Side Panel supports multiple views with smooth transitions, all rendered within the panel:

| View | Description | Access |
|---|---|---|
| **Home** | Default view with quick actions + session list | Panel open |
| **Session Detail** | Expand a session to see all tabs, groups, and metadata | Click a session card |
| **Tab Groups** | Browse and manage saved tab groups across sessions | Bottom nav or filter |
| **Settings** | Auto-save config, shortcuts, theme, import/export triggers | Gear icon |
| **Import/Export** | File picker, format selection, drag-and-drop zone | Settings → Import/Export |

Navigation uses a back-button stack with animated slide transitions.

### 10.5 Side Panel + Popup Coexistence

The user can choose their preferred primary UI in settings. When set to Side Panel (recommended), clicking the extension icon opens/toggles the Side Panel. When set to Popup mode, the extension icon opens a traditional popup, and the Side Panel is accessible via keyboard shortcut only. The user can also right-click the icon to access the alternative interface.

### 10.6 Side Panel Technical Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| SP-001 | Side Panel opens via toolbar icon click | 🔴 Critical |
| SP-002 | Side Panel is available globally on all tabs (not tab-specific) | 🔴 Critical |
| SP-003 | Side Panel state persists when switching tabs (scroll position, active view) | 🟠 High |
| SP-004 | Side Panel loads in < 150ms | 🟠 High |
| SP-005 | Side Panel communicates with service worker via message passing | 🔴 Critical |
| SP-006 | Side Panel supports full keyboard navigation within panel | 🟠 High |
| SP-007 | Side Panel respects system dark/light mode and allows manual toggle | 🟠 High |
| SP-008 | Side Panel renders correctly at minimum width of 300px | 🟠 High |
| SP-009 | Virtual scrolling for session list with 500+ items | 🟡 Medium |
| SP-010 | Side Panel includes drag-and-drop zone for file import | 🔵 Low |

---

## 11. New Tab Page Override

Session Saver replaces Chrome's default new tab page with a fully customizable **command center** — a glassmorphism-styled dashboard for bookmarks, quick links, a built-in to-do list, and session management. This feature uses the Manifest V3 chrome_url_overrides.newtab API.

### 11.1 Manifest Requirements

The New Tab Override requires adding the chrome_url_overrides.newtab declaration to the manifest, along with these additional permissions beyond the existing Session Saver permissions: topSites (for quick links auto-population), bookmarks (for reading/writing Chrome bookmarks), favicon (for fetching site icons), and an optional history permission (for the Frequently Visited view). A host_permissions entry for chrome://favicon/* is also required.

### 11.2 Feature Toggle

Since Chrome does not allow dynamic toggling of chrome_url_overrides, the disable behavior works as follows:

| Setting | Behavior |
|---|---|
| **Enabled** (default) | Full New Tab page renders with all widgets |
| **Disabled** | New Tab page immediately redirects to Chrome's default new tab page |
| **Minimal Mode** | Shows only the search bar + clock over the wallpaper (no bookmarks, no sidebar) |

The toggle is accessible from: Settings → Interface → New Tab Page → Enable/Disable.

### 11.3 Layout Modes

Session Saver's New Tab page supports **three layout modes** the user can switch between at any time. Each mode progressively reveals more UI:

| Mode | Description | Best For |
|---|---|---|
| **Minimal** | Search bar + clock + wallpaper only. No sidebar, no cards, no widgets. Clean and distraction-free. | Users who want a beautiful, fast start page |
| **Focus** | Search bar + clock + quick links row + to-do list widget. No sidebar, no bookmark grid. | Users who want quick access + task tracking without clutter |
| **Dashboard** | Full layout: sidebar + search bar + clock + quick links + bookmark grid + to-do list + session widget. All features visible. | Power users who want a full command center |

**Switching modes:** Users can cycle through modes with Ctrl+Shift+L, pick from the Customize panel (which shows 3 preview thumbnails), or set a default in settings. The choice persists across browser restarts.

### 11.4 Glassmorphism UI Design System

The entire New Tab page uses a **glassmorphism** design language — frosted glass panels floating over rich wallpaper backgrounds. This creates a modern, layered, translucent aesthetic.

#### 11.4.1 Core Glass Design Principles

Every panel, card, and container on the New Tab page is rendered as a semi-transparent frosted glass surface. The base glass panel uses a light white tint (roughly 8% opacity) with a 16px backdrop blur and 180% saturation boost. A subtle 1px semi-transparent white border provides edge definition, and a soft shadow gives depth. An inset highlight along the top edge simulates light refraction.

In **dark theme**, panels shift to a darker tint (roughly 25% black opacity) with reduced border brightness. In **light theme**, panels become more opaque (roughly 55% white opacity) with brighter, more visible borders. Interactive glass elements respond to hover by increasing opacity slightly, shifting the border brighter, and lifting upward by 1px with a smooth 200ms transition.

Elevated glass surfaces (modals, dropdowns, context menus) use a stronger blur of 24px and deeper shadows to establish hierarchy.

#### 11.4.2 Glass Component Hierarchy

| Component | Blur Intensity | Opacity | Border Radius | Usage |
|---|---|---|---|---|
| Sidebar | Heavy (20px) | Low (0.10) | 0 (flush to edge) | Left navigation panel |
| Search Bar | Very heavy (24px) | Medium (0.15) | 24px (pill shape) | Central search input |
| Category Card | Standard (16px) | Low (0.08) | 16px | Bookmark group container |
| To-Do Widget | Standard (16px) | Low (0.08) | 16px | Task list panel |
| Quick Link Chip | Light (12px) | Very low (0.06) | 50% (circle) | Favicon shortcut button |
| Modal / Overlay | Very heavy (24px) | High (0.30) | 20px | Settings, customization panels |
| Toast Notification | Standard (16px) | Medium (0.20) | 12px | Confirmation messages |
| Context Menu | Heavy (20px) | Medium-high (0.25) | 12px | Right-click menus |

#### 11.4.3 Theme System

| Theme | Behavior |
|---|---|
| **Dark** (default) | Dark tinted glass panels, white text, works best with all wallpapers |
| **Light** | White-tinted glass panels, dark text, brighter feel |
| **Auto** | Follows the operating system's color scheme setting, transitions smoothly when the OS toggles |

Theme switching animates with a 300ms crossfade. All styling uses CSS custom properties for instant theme switching without full re-render. The Ctrl+Shift+T shortcut toggles between dark and light manually.

### 11.5 Wallpaper & Background System

#### 11.5.1 Background Types

| Type | Description | Storage Location |
|---|---|---|
| **Solid Color** | Single color picker with color presets | Chrome local storage (hex string) |
| **Gradient** | 15+ built-in gradient presets plus a custom dual-color gradient builder with adjustable angle control | Chrome local storage |
| **Built-in Wallpapers** | 15 high-quality bundled images organized by category (nature, abstract, space, city) | Bundled within the extension assets |
| **User Upload** | Custom image upload supporting JPG, PNG, and WebP formats, max 5MB per image, max 10 images stored | IndexedDB as blob |
| **Daily Rotation** | Auto-cycles through built-in wallpapers daily, changing at midnight local time | Chrome local storage (rotation index + date) |

#### 11.5.2 Background Adjustments

All adjustments apply as CSS filters on the background layer only and do not affect the foreground UI:

| Setting | Control Type | Default | Range |
|---|---|---|---|
| Blur Amount | Slider | 0px | 0 — 30px |
| Dimming Overlay | Slider | 30% | 0% — 80% |
| Saturation | Slider | 100% | 50% — 150% |
| Brightness | Slider | 100% | 50% — 120% |
| Vignette | Toggle | OFF | ON / OFF (adds radial dark edges for dramatic focus effect) |

The Ctrl+Shift+W shortcut opens the wallpaper picker modal directly.

### 11.6 Quick Links Row

A horizontal row of circular favicon shortcuts displayed below the search bar, providing one-click access to frequently used sites.

#### 11.6.1 Quick Links Features

| Feature | Description |
|---|---|
| Auto-populated | Default: top 8 sites from Chrome's topSites API |
| Manual add | "+" button to add a custom URL with a label |
| Edit | Right-click or long-press any quick link to edit its name, URL, or icon |
| Delete | Right-click to remove, or drag to a trash zone |
| Drag-and-drop reorder | Drag quick links to rearrange their position in the row |
| Custom favicon | Auto-fetched via Chrome's favicon API; falls back to a first-letter avatar if unavailable |
| Max visible | 10 icons visible in the row; horizontally scrollable if more exist |
| Tooltip | Hovering shows the full site name and URL |
| Click behavior | Single click opens in the current tab; middle-click opens in a new tab |

#### 11.6.2 Quick Link Visual Design

Each quick link appears as a 56px circular glass container with a 40px favicon centered inside. The glass background is very subtle with a light blur. On hover, the icon scales to 110% with a soft glow ring around it. A short label (truncated to 6 characters) appears below each icon. The entire row is horizontally scrollable with a "+" button at the end for adding new links.

### 11.7 Bookmark Management System

The primary feature of the New Tab page — a visual bookmark organizer with boards, categories, and drag-and-drop glass cards.

#### 11.7.1 Boards

| Feature | Description |
|---|---|
| Multiple Boards | Users can create unlimited boards (e.g., "Work", "Personal", "Research") |
| Default Board | "My Board" is created on first install, pre-populated with sample categories |
| Board Switching | Switch via the sidebar list or keyboard shortcuts Ctrl+1 through Ctrl+9 |
| Board Actions | Create, rename, delete, reorder, and duplicate boards |
| Board Icon | Each board has a customizable emoji or icon |

#### 11.7.2 Category Cards (Drag-and-Drop)

Categories are displayed as **glass cards in a responsive grid** (2-4 columns depending on screen width). Each card is a draggable container styled with the glassmorphism design system.

**Card layout:** Each category card has a header showing an icon, the category name, and a three-dot menu button. Below the header is a list of bookmarks, each showing a favicon and the site name as a clickable link. At the bottom of each card is an "+ Add Bookmark" action that opens an inline URL input field.

**Card features:**

| Feature | Description |
|---|---|
| Drag entire card | Reorder cards in the grid by grabbing the drag handle in the header |
| Drag bookmarks between cards | Move individual bookmarks from one category to another by dragging them |
| Collapse/expand | Click the card header to collapse the body, showing only the title and bookmark count |
| Inline add | "+ Add Bookmark" at the bottom of each card opens an inline URL input |
| Context menu | Right-click a card to rename, change icon, duplicate, delete, or change its accent color |
| Card color accent | Optional colored left border or subtle tint from 8 available colors |
| Bookmark count badge | Shows the number of bookmarks when the card is in collapsed state |

#### 11.7.3 Drag-and-Drop System

All drag-and-drop interactions across the New Tab page (cards, bookmarks, quick links, to-do items) use a unified drag-and-drop system built with the @dnd-kit library:

| Aspect | Description |
|---|---|
| Card reorder | Sortable grid strategy allows dragging category cards to new positions in the grid |
| Bookmark move | Droppable category zones accept bookmarks dragged from other cards |
| Quick link reorder | Sortable horizontal strategy for rearranging quick link positions |
| To-do reorder | Sortable vertical strategy for reordering tasks within a list |
| Visual feedback | A ghost element at 50% opacity follows the cursor; valid drop zones highlight with a dashed border |
| Animation | Smooth layout transitions when items are reordered |
| Touch support | Pointer and touch sensors with a 250ms activation delay to prevent conflicts with scrolling |
| Keyboard accessibility | Enter to grab a focused item, arrow keys to move, Enter to drop, Escape to cancel |

#### 11.7.4 Card Density Settings

Users can adjust how compact or spacious bookmark cards appear. This is critical for users managing hundreds of bookmarks.

| Density | Row Height | Font Size | Favicon Size | Card Padding | Card Gap | Best For |
|---|---|---|---|---|---|---|
| **Compact** | 28px | 12px | 16px | 8px vertical, 10px horizontal | 12px | Hundreds of bookmarks, power users, small screens |
| **Comfortable** (default) | 38px | 14px | 20px | 12px vertical, 16px horizontal | 16px | Balanced readability and density, general use |

**Switching density:** Available in Settings → Appearance → Card Density, or via the Ctrl+Shift+D keyboard shortcut which toggles between the two modes. The switch persists across browser restarts and animates with a smooth 200ms height transition.

**Performance at scale (Compact mode):** Virtual scrolling activates on the bookmark grid when total bookmarks exceed 200, rendering only the cards visible in the viewport plus a one-screen buffer. Favicon URLs are cached aggressively. Target: 500 bookmarks across 30 categories renders in under 200ms with 60fps scrolling.

#### 11.7.5 Native Bookmarks Integration

| Feature | Description |
|---|---|
| Import from Chrome | One-click import from Chrome's native bookmarks tree |
| Sync mode | Optional two-way sync: changes in Session Saver reflect in Chrome bookmarks and vice versa |
| Sidebar tree | Native bookmark folders shown in sidebar: Bookmarks Bar, Other Bookmarks, Mobile Bookmarks |
| Grouped by Website | Auto-categorize native bookmarks by domain (e.g., all github.com links grouped together) |
| Conflict resolution | On import: skip duplicates, merge, or overwrite — user chooses |

#### 11.7.6 Bookmark Search

Full-text search across all bookmarks covering name, URL, category name, and board name. Results appear in real-time with debounced input (200ms delay), with matching terms highlighted in bold. Users can filter results by board, category, or search everything. The search bar is accessible from anywhere on the page via Ctrl+K or the / key.

### 11.8 Built-in To-Do List Widget

A lightweight task manager widget integrated into the New Tab page, visible in **Focus** and **Dashboard** layout modes. Styled as a glass panel matching the bookmark cards.

#### 11.8.1 To-Do Features

| Feature | Description |
|---|---|
| Add task | Inline input at the top of the widget; press Enter to add |
| Complete task | Click the checkbox; task gets a strikethrough and moves to a "Done" section |
| Delete task | Swipe left on touch or click the trash icon |
| Drag-and-drop reorder | Drag tasks within the list to reorder them |
| Priority levels | Optional: flag a task as High (red dot), Medium (yellow dot), or Low (green dot) |
| Due date | Optional: date picker; overdue tasks are highlighted in red |
| Multiple task lists | Create separate lists (e.g., "Today", "Work", "Personal") switchable via tabs in the widget header |
| Persistent storage | Stored in IndexedDB; survives browser restarts |
| Quick entry shortcut | Ctrl+T from the New Tab page focuses the to-do input immediately |

#### 11.8.2 To-Do Widget Layout

The widget header shows a checkmark icon, the title "To-Do", and a dropdown to switch between task lists. Below is an input field for adding new tasks. The main area lists active tasks, each with a checkbox, optional priority color dot, and the task text. Below the active tasks is a collapsible "Completed" section (collapsed by default) showing done tasks with strikethrough styling and a count badge. A "Clear all completed" button appears in the completed section header. In Dashboard mode, the widget sits in the right column. In Focus mode, it appears below the quick links row.

#### 11.8.3 To-Do Data Model

**TodoItem:** Each task stores an ID, text content, completed status, priority level (high/medium/low/none), optional due date (ISO 8601 format), reference to which list it belongs to, a position number for sort order, a creation timestamp, and an optional completion timestamp.

**TodoList:** Each list stores an ID, name, emoji icon, position number for ordering, and a creation timestamp.

### 11.9 Global Keyboard Shortcuts

The New Tab page registers comprehensive keyboard shortcuts for power users. All shortcuts are customizable in Settings. Pressing the ? key at any time shows a keyboard shortcuts cheat sheet modal.

| Shortcut | Action | Scope |
|---|---|---|
| / or Ctrl+K | Focus search bar | Global |
| Ctrl+Shift+L | Cycle layout mode (Minimal → Focus → Dashboard) | Global |
| Ctrl+Shift+D | Toggle card density (Compact ↔ Comfortable) | Global |
| Ctrl+T | Focus to-do input | Global |
| Ctrl+N | Add new bookmark to active category | Dashboard |
| Ctrl+Shift+N | Create new category | Dashboard |
| Ctrl+1 — Ctrl+9 | Switch to board 1-9 | Dashboard |
| Ctrl+B | Toggle sidebar visibility | Dashboard |
| Ctrl+, | Open settings | Global |
| Escape | Close modal / deselect / exit search | Global |
| Tab / Shift+Tab | Navigate between cards and bookmarks | Global |
| Enter | Open focused bookmark / expand card | Global |
| Delete | Delete focused bookmark (with undo confirmation) | Dashboard |
| Ctrl+Z | Undo last action (delete, move, reorder) | Global |
| Ctrl+Shift+T | Toggle theme (dark ↔ light) | Global |
| Ctrl+Shift+W | Open wallpaper picker | Global |
| ? | Show keyboard shortcuts cheat sheet | Global |

### 11.10 Top Navigation Tabs

A horizontal tab bar below the search bar for switching content views:

| Tab | Icon | Content | Available In |
|---|---|---|---|
| **Quick Links** (default) | 🔗 | Quick links row + bookmark category grid | Dashboard |
| **Frequently Visited** | 🕐 | Auto-populated grid from Chrome's topSites and browsing history | All modes |
| **Tabs** | 📑 | Current open tabs grouped by tab groups with colors (Session Saver integration) | Dashboard, Focus |
| **Activity** | 📊 | Recent bookmark activity log: added, deleted, moved, restored | Dashboard |
| **All** | 📚 | Flat list of all bookmarks across all boards, fully searchable and filterable | Dashboard |

### 11.11 Session Saver Integration

The New Tab page is deeply integrated with the core Session Saver functionality:

| Integration Point | Description |
|---|---|
| **Session Widget** | Mini-widget showing last 3-5 saved sessions with one-click restore button |
| **Save Session Button** | Quick "Save Session" action accessible from all layout modes |
| **Auto-Save Indicator** | Small badge showing auto-save status: active, paused, or last save time |
| **Tabs View** | "Tabs" navigation tab shows current open tabs grouped by tab groups with colors |
| **Shared Stores** | Reuses the same session, auto-save, and theme hooks from the shared layer |
| **Shared Core Services** | Reuses session service, tab-group service, and search service from the core layer |
| **Unified Theme** | Theme setting syncs across New Tab, Side Panel, popup, and dashboard |
| **Unified Settings** | Single settings store shared across all UI surfaces |

### 11.12 Sidebar

The left sidebar (visible only in Dashboard mode) provides navigation and organization:

**Boards Section:** Lists all user-created boards. Click to switch the active board. "+" New Board" button at the bottom. Boards can be reordered via drag-and-drop.

**Native Bookmarks Section:** Expandable tree showing Chrome's native bookmark folders: Bookmarks Bar, Other Bookmarks, Mobile Bookmarks. Clicking a native folder shows its contents in the main grid. A "Grouped by Website" option auto-categorizes bookmarks by domain.

**Bottom Section:** "Get Pro" upgrade button (for freemium model), "Zen Mode" toggle (hides the sidebar and shows only the content area for a clean look), "Backup & Restore" link (ties into the existing Session Saver import/export system), "Trash" (recently deleted bookmarks and categories, restorable for 30 days), and a link to the extension website and Help Center.

The sidebar is collapsible via the Ctrl+B shortcut or a toggle button.

### 11.13 New Tab Page Data Models

**Board:** Each board stores an ID, name, emoji/icon, an ordered array of category IDs, and creation/update timestamps.

**BookmarkCategory:** Each category stores an ID, parent board ID reference, name, icon, accent color (hex), ordered array of bookmark IDs, collapsed state, and a creation timestamp.

**BookmarkEntry:** Each bookmark stores an ID, parent category ID, title, URL, favicon URL, addition timestamp, a flag indicating whether it was synced from Chrome's native bookmarks, and an optional native bookmark ID for sync purposes.

**QuickLink:** Each quick link stores an ID, title, URL, favicon URL, position number, and a flag indicating whether it was auto-generated from topSites or manually added.

**NewTabSettings:** Stores all New Tab preferences including: enabled state, layout mode (minimal/focus/dashboard), card density (compact/comfortable), search engine choice (Google/Bing/DuckDuckGo/custom with optional custom URL), clock format (12h/24h), visibility toggles for clock, quick links, bookmarks, to-do widget, and session widget, background type (solid/gradient/image/custom), background color/gradient/image reference, background adjustment values (blur 0-30, dimming 0-80, saturation 50-150, brightness 50-120, vignette on/off), daily rotation toggle, theme (dark/light/auto), default view, active board ID, zen mode state, and sidebar collapsed state.

### 11.14 New Tab Performance Targets

| Metric | Target | Strategy |
|---|---|---|
| Page Load (TTI) | < 300ms | Code-split by layout mode; Minimal loads a tiny bundle, Dashboard loads the full bundle |
| First Contentful Paint | < 150ms | Inline critical CSS, defer non-visible components |
| Bundle Size (gzipped) | < 200KB (Dashboard), < 60KB (Minimal) | Tree-shaking, lazy imports, shared chunks with other surfaces |
| Scroll FPS | 60fps | Virtual scrolling for 500+ bookmarks |
| Wallpaper Load | < 500ms | Progressive image loading, lazy load, cached in IndexedDB |
| Search Latency | < 100ms | Pre-built in-memory search index on page load |
| Drag-and-Drop FPS | 60fps | CSS transforms only during drag, no layout recalculation |
| Memory (Dashboard) | < 25MB | Virtual scrolling, favicon cache eviction at memory threshold |

### 11.15 New Tab Feature Requirements Summary

| Req ID | Requirement | Priority |
|---|---|---|
| NT-001 | Override Chrome's new tab page with custom page | 🔴 Critical |
| NT-002 | Three layout modes: Minimal, Focus, Dashboard | 🔴 Critical |
| NT-003 | Glassmorphism UI with frosted glass panels across all components | 🔴 Critical |
| NT-004 | Light / Dark / Auto theme support with smooth 300ms crossfade transition | 🔴 Critical |
| NT-005 | Customizable wallpapers: solid color, gradient presets, built-in gallery, user-uploaded images | 🟠 High |
| NT-006 | Background adjustments: blur, dimming, saturation, brightness, and vignette controls | 🟠 High |
| NT-007 | Daily wallpaper rotation from built-in gallery | 🟡 Medium |
| NT-008 | Quick Links row with drag-and-drop reorder, auto-populate from Chrome topSites | 🔴 Critical |
| NT-009 | Bookmark boards with categories displayed as drag-and-drop glassmorphism cards | 🔴 Critical |
| NT-010 | Drag bookmarks between category cards | 🟠 High |
| NT-011 | Card density: Compact / Comfortable with Ctrl+Shift+D keyboard toggle | 🟠 High |
| NT-012 | Virtual scrolling optimized for 500+ bookmarks at 60fps | 🟠 High |
| NT-013 | Built-in to-do list widget with priorities, due dates, and multiple task lists | 🟠 High |
| NT-014 | To-do drag-and-drop reorder within lists | 🟡 Medium |
| NT-015 | Native Chrome bookmarks import/sync via bookmarks API | 🟠 High |
| NT-016 | Full-text bookmark search with Ctrl+K / / shortcut | 🟠 High |
| NT-017 | Global keyboard shortcuts (16+ shortcuts) with customization and ? cheat sheet | 🟠 High |
| NT-018 | Top navigation tabs: Quick Links, Frequent, Tabs, Activity, All | 🟡 Medium |
| NT-019 | Session Saver integration: session widget, save button, auto-save indicator | 🟠 High |
| NT-020 | Feature toggle: enable/disable New Tab override in settings | 🔴 Critical |
| NT-021 | Sidebar with boards list, native bookmarks tree, Zen Mode, Trash | 🟠 High |
| NT-022 | User-uploaded wallpaper images stored in IndexedDB (max 5MB each, max 10 images) | 🟡 Medium |
| NT-023 | Gradient builder with angle control and 15+ presets | 🟡 Medium |
| NT-024 | Undo system: Ctrl+Z for delete, move, and reorder actions | 🟡 Medium |

---

## 12. Technical Architecture

### 12.1 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Extension Platform | Chrome Manifest V3 | Required for Chrome Web Store, uses service workers |
| Primary UI Surface | Chrome Side Panel API | Persistent, full-height panel docked to browser |
| New Tab Surface | chrome_url_overrides.newtab | Custom glassmorphism start page with bookmarks, to-do, quick links |
| Frontend Framework | React 18+ with TypeScript | Component-based, type-safe, large ecosystem |
| State Management | Zustand | Lightweight, TypeScript-native, no boilerplate |
| Styling | Tailwind CSS + CSS Modules | Utility-first, dark mode support, scoped styles |
| Build Tool | Vite + CRXJS Plugin | Fast builds, HMR for extensions, Manifest V3 support |
| Storage | chrome.storage.local + IndexedDB | Local for settings, IndexedDB for large session and bookmark data |
| Testing | Vitest + Testing Library + Playwright | Unit, integration, and E2E testing |
| Linting | ESLint + Prettier + Husky | Code quality and consistency enforcement |
| Icons | Lucide React | Consistent, tree-shakable, MIT licensed |
| Animation | Framer Motion | Performant micro-interactions and page transitions |
| Virtual Scrolling | @tanstack/react-virtual | Performant rendering for large lists (sessions, bookmarks) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | Accessible, performant DnD for cards, bookmarks, quick links, to-do items |

### 12.2 Architecture Overview

Session Saver follows a layered architecture pattern optimized for Chrome extension development with clear separation of concerns.

**Layer 1 — Background Service Worker:** Handles all Chrome API interactions, auto-save engine, event listeners, alarm management, and Side Panel lifecycle control.

**Layer 2 — Storage Layer:** Abstracted storage interface supporting chrome.storage.local for settings and IndexedDB for session data, bookmark data, to-do items, and uploaded wallpapers, with a unified API.

**Layer 3 — Core Business Logic:** Session CRUD operations, tab group management, bookmark management, to-do management, import/export processors, search indexing. Framework-agnostic, fully testable.

**Layer 4 — UI Layer:** React components for Side Panel, New Tab page, popup, and dashboard. Zustand stores and presentation logic. Shared component library across all surfaces.

### 12.3 Data Models

**Session:** Stores ID (UUID), name, creation and update timestamps, tabs array, tab groups array, source window ID, tags array, pinned/starred/locked/auto-save flags, auto-save trigger type, notes, tab count, and schema version for migrations.

**Tab:** Stores ID, URL, title, favicon URL, index position, pinned state, group ID (-1 if ungrouped), active state, and scroll position (x, y).

**TabGroup:** Stores ID, title, color (Chrome group color enum), collapsed state, and tab IDs array.

### 12.4 Message Protocol

Communication between the service worker and all UI surfaces (Side Panel, New Tab, popup, dashboard) uses typed message passing. The message types include: save session, restore session, delete session, get sessions with filter/sort, get current tabs, export sessions, import sessions, update settings, get auto-save status, get top sites, get bookmarks tree, sync bookmarks, and to-do sync.

---

## 13. Project Structure

The project follows a feature-based modular architecture designed for maintainability and extensibility. Each UI surface (sidepanel, newtab, popup, dashboard) is self-contained with its own components, views, stores, and services.

### 13.1 Directory Layout

**Root level:** Contains public/ (extension icons, manifest.json), src/ (all source code), tests/ (unit, integration, e2e), _locales/ (i18n message files for English, Arabic, etc.), and config files (vite.config, tsconfig, tailwind.config, package.json, README).

**src/background/:** Service worker entry point, auto-save engine, Chrome event handlers, Side Panel controller, and alarms management.

**src/core/types/:** TypeScript interfaces for sessions, tabs, tab groups, settings, messages (service worker ↔ UI protocol), storage types, bookmark models (Board, BookmarkCategory, BookmarkEntry, QuickLink), to-do models (TodoItem, TodoList), and New Tab settings.

**src/core/services/:** Session CRUD, tab group management, bookmark management, to-do management, full-text search indexing, export processors (JSON, HTML, MD, CSV), import processors and validators, and data schema migrations.

**src/core/storage/:** Abstract storage interface, chrome.storage.local adapter, IndexedDB adapter, and a storage factory for provider selection.

**src/core/utils/:** UUID generation, date formatting, data validators, and debounce/throttle utilities.

**src/sidepanel/:** Side Panel root app, entry point, HTML shell, views (Home, Session Detail, Tab Groups, Settings, Import/Export), components (Header, Quick Actions, Session List, Session Card, Search Bar, Tab Group Preview, Auto-Save Badge, Navigation Stack), and Zustand store.

**src/newtab/:** New Tab root app with layout mode router, entry point, HTML shell. Contains three layout components (MinimalLayout, FocusLayout, DashboardLayout), five view components (QuickLinksView, FrequentView, TabsView, ActivityView, AllBookmarksView), and a rich set of components: SearchBar (glassmorphism), ClockWidget, QuickLinksRow (draggable), BookmarkGrid, CategoryCard (draggable, density-aware), BookmarkItem, Sidebar (boards, native bookmarks, Zen Mode), BoardSwitcher, TodoWidget, TodoItem (draggable), SessionWidget, BackgroundLayer (wallpaper + filters), BackgroundPicker (customization modal), TopNav, CustomizePanel (layout/density/theme settings), DensityToggle, LayoutModePicker, KeyboardShortcutsModal (? key cheat sheet), TrashBin, and GlassContainer (reusable glass wrapper). Stores include newtab state, bookmarks, quick links, to-do, and background preferences. Services include Chrome bookmarks API wrapper, topSites wrapper, quick links CRUD, and to-do CRUD.

**src/popup/:** Minimal popup root app, entry point, and HTML shell for the quick-action fallback UI.

**src/dashboard/:** Full dashboard root app, entry point, HTML shell, pages (Sessions, Auto-Saves, Tab Groups, Import/Export, Settings), components (Sidebar, Session Detail, Bulk Toolbar, Stats Widget), and Zustand store.

**src/shared/:** Shared components (Button, Modal, Toast, Tooltip, Badge, ContextMenu, EmptyState, LoadingSpinner), shared hooks (useSession, useAutoSave, useSearch, useKeyboard, useTheme, useMessaging, useDragAndDrop, useGlass), and shared styles (globals.css with Tailwind base and custom properties, themes.css with light/dark theme variables).

**src/content/:** Content script for capturing scroll position.

### 13.2 Key Architecture Decisions

- **Side Panel as primary session UI:** Designed for the vertical, always-visible Side Panel layout; popup is a stripped-down fallback
- **New Tab Page as command center:** Glassmorphism dashboard for bookmarks, to-do, and quick links; shares core services with all other surfaces
- **Feature-based structure:** Each UI surface (sidepanel, newtab, popup, dashboard) is self-contained with its own components, stores, and views
- **Core layer is framework-agnostic:** Services and storage can be tested without React or browser APIs
- **Shared components and hooks** ensure UI consistency across all four surfaces
- **Storage abstraction** allows swapping between chrome.storage and IndexedDB without changing business logic
- **TypeScript strict mode** throughout for maximum type safety
- **Typed message protocol** between service worker and all UI surfaces prevents runtime communication errors
- **Single responsibility** for each service with a clean, testable API
- **Vite build configuration** with separate entry points for each surface (sidepanel, newtab, popup, dashboard, background) enabling independent code-splitting and bundle optimization

---

## 14. Chrome Web Store Requirements

### 14.1 Manifest V3 Compliance

| Requirement | Status | Notes |
|---|---|---|
| Service Worker (no background pages) | Required | Background scripts must use service worker pattern |
| Side Panel declaration | Required | side_panel key in manifest |
| New Tab Override declaration | Required | chrome_url_overrides.newtab key in manifest |
| Declarative Net Request (if needed) | N/A | Session Saver does not modify network requests |
| Permissions: minimal scope | Required | Only request permissions actually used |
| Content Security Policy | Required | No inline scripts, strict CSP in manifest |
| Remote code prohibition | Required | All code bundled locally, no remote script loading |

### 14.2 Required Permissions

| Permission | Type | Justification |
|---|---|---|
| tabs | Required | Read tab URLs, titles, and state for saving sessions |
| tabGroups | Required | Read and create tab groups during save/restore |
| storage | Required | Persist sessions, bookmarks, and settings locally |
| alarms | Required | Schedule periodic auto-save intervals |
| idle | Required | Detect system idle/sleep for auto-save triggers |
| sidePanel | Required | Register and control the Side Panel UI |
| topSites | Required | Populate quick links from frequently visited sites on New Tab page |
| bookmarks | Required | Read/write Chrome bookmarks for New Tab bookmark manager |
| favicon | Required | Fetch site favicons for bookmarks and quick links display |
| activeTab | Required | Access active tab for scroll position capture |
| system.display | Optional | Detect sleep events on some platforms |
| history | Optional | Populate "Frequently Visited" view on New Tab page |

### 14.3 Manifest Configuration Summary

The manifest.json declares manifest_version 3, the extension name "Session Saver", version, and description. It lists all required and optional permissions, host_permissions for the favicon API, the chrome_url_overrides.newtab entry pointing to the New Tab HTML file, the side_panel default_path, the background service worker entry, the action configuration with icons and title, the extension icons at 16/32/48/128px, and the commands configuration for keyboard shortcuts (with Ctrl+Shift+S as the suggested key for the primary action).

### 14.4 Store Listing Assets

| Asset | Specification |
|---|---|
| Extension Icon | 128x128 PNG with transparent background |
| Promotional Tile (Small) | 440x280 PNG |
| Promotional Tile (Large) | 920x680 PNG |
| Screenshots | 1280x800 or 640x400 PNG (min 1, max 5) — should include New Tab page, Side Panel, and Dashboard |
| Description | Up to 132 characters (short), full description up to 16,000 chars |
| Category | Productivity |
| Language | English (primary), with i18n support for additional locales |
| Privacy Policy URL | Required (hosted on project website or GitHub Pages) |

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Metric | Target | Measurement |
|---|---|---|
| Side Panel Load Time | < 150ms | Time from icon click to interactive UI |
| Popup Load Time | < 200ms | Time from click to interactive UI |
| New Tab Load (TTI) | < 300ms | Time from new tab open to interactive page |
| New Tab Memory (Dashboard) | < 25MB | Dashboard layout with 500 bookmarks loaded |
| New Tab Bundle (gzipped) | < 200KB (Dashboard), < 60KB (Minimal) | Per-layout code-split bundles |
| Session Save (100 tabs) | < 500ms | Time from click to save confirmation |
| Session Restore (100 tabs) | < 2s | Time from click to all tabs created |
| Search Response | < 100ms | Time from keystroke to filtered results |
| Storage Footprint | < 50MB | Total storage for 500 sessions + bookmarks |
| Memory Usage (Idle) | < 5MB | Service worker memory when not actively saving |
| Side Panel Memory | < 15MB | Side Panel React app idle memory |
| Dashboard Load | < 1s | Time to interactive dashboard page |
| Drag-and-Drop FPS | 60fps | Smooth dragging with CSS transforms only |
| Bookmark Scroll FPS | 60fps | Virtual scrolling with 500+ bookmarks |

### 15.2 Security & Privacy

- All session and bookmark data stored locally on the user's device; no data sent to external servers
- No analytics or tracking without explicit user opt-in
- Exported files contain only session/bookmark metadata, never cookies or authentication tokens
- Content Security Policy enforced to prevent XSS
- Regular dependency audits via npm audit
- User-uploaded wallpaper images stored only in local IndexedDB, never transmitted

### 15.3 Accessibility

- WCAG 2.1 AA compliance for all UI components across all surfaces
- Full keyboard navigation with visible focus indicators
- Screen reader support with ARIA labels on all interactive elements
- Color contrast ratio minimum 4.5:1 for text, 3:1 for large text
- Reduced motion support via prefers-reduced-motion media query
- Side Panel supports full Tab/Shift+Tab navigation between sections
- New Tab drag-and-drop fully operable via keyboard (Enter to grab, arrows to move, Enter to drop)
- Glassmorphism panels maintain sufficient contrast ratios against all wallpaper backgrounds via dimming overlay

### 15.4 Internationalization

- All user-facing strings extracted to i18n message files (chrome.i18n API)
- RTL layout support for Arabic, Hebrew, and other RTL languages
- Initial launch: English, Arabic, Spanish, French, German, Japanese, Chinese (Simplified)
- Date and number formatting respects user locale

---

## 16. Analytics & Metrics

All analytics are opt-in and privacy-respecting. No personally identifiable information is collected.

### 16.1 Key Performance Indicators (KPIs)

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
| New Tab Adoption Rate | >= 80% | % of users keeping New Tab override enabled |
| Dashboard Layout Usage | >= 40% | % of New Tab users using Dashboard mode |

### 16.2 Tracked Events (Opt-In Only)

- session_saved — manual vs. auto, trigger type, tab count
- session_restored — full vs. selective, tab count
- export_completed — format type
- import_completed — source type, session count
- auto_save_triggered — trigger type
- ui_surface_used — sidepanel vs. popup vs. dashboard vs. newtab
- newtab_layout_mode — minimal vs. focus vs. dashboard usage
- newtab_card_density — compact vs. comfortable preference
- newtab_todo_usage — tasks created, completed, deleted
- newtab_bookmark_action — add, move, delete, search
- error_occurred — error type, component, anonymized stack trace

---

## 17. Release Roadmap

### 17.1 Phase 1: MVP (v1.0) — 10 Weeks

Core functionality for Chrome Web Store launch.

| Week | Milestone | Deliverables |
|---|---|---|
| 1-2 | Project Setup & Core Architecture | Build tool scaffolding, storage layer, data models, CI/CD pipeline, Side Panel shell |
| 3-4 | Session Save & Restore | One-click save, full restore, selective restore, tab metadata capture |
| 5 | Auto-Save Engine | Service worker triggers, battery/sleep/shutdown detection, alarm-based periodic saves |
| 6 | Tab Group Support | Save/restore tab groups with colors and names, group-level operations |
| 7 | UI Polish & Import/Export | Side Panel + popup + dashboard UI, JSON/HTML export, JSON import, dark mode |
| 8 | New Tab Page (Minimal + Focus) | New Tab Override, glassmorphism search bar + clock, quick links, background system, to-do widget |
| 9 | New Tab Page (Dashboard) | Bookmark boards + category cards, drag-and-drop, card density, native bookmarks import, sidebar |
| 10 | Testing & Store Submission | E2E tests, performance audit, store listing assets, submission |

### 17.2 Phase 2: Enhanced (v1.5) — 6 Weeks

- Session search with full-text indexing
- Session tagging, pinning, and starring
- Bulk operations (multi-select delete, export, merge)
- Additional export formats (Markdown, CSV, plain text)
- Keyboard shortcut customization
- Import from other session managers (OneTab, Session Buddy)
- Side Panel drag-and-drop import
- New Tab daily wallpaper rotation and gradient builder
- New Tab advanced to-do features (due dates, multiple lists)

### 17.3 Phase 3: Pro (v2.0) — 8 Weeks

- Cloud sync across devices (optional, encrypted)
- Session sharing via link
- Session templates (pre-defined tab collections for common workflows)
- Session scheduling (auto-open sessions at specific times)
- Advanced analytics dashboard
- Team/workspace features for shared session libraries
- Shared bookmark boards for team collaboration

---

## 18. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chrome API changes break auto-save triggers | Medium | High | Abstract all Chrome APIs behind interfaces; monitor Chromium changelogs |
| Side Panel API changes or deprecation | Low | Critical | Maintain popup as fallback UI; abstract UI surface behind routing layer |
| Large session data exceeds storage limits | Medium | Medium | Implement data compression; use IndexedDB for overflow; add storage usage warnings |
| Service worker terminated during save | Low | High | Implement atomic save operations with rollback; use alarms as heartbeat |
| Manifest V3 restrictions limit functionality | Low | Medium | Design within MV3 constraints from day one; no reliance on MV2-only features |
| Store rejection due to permission scope | Low | High | Request minimal permissions; justify each in submission; phased permission requests |
| Poor performance with 200+ tabs | Medium | Medium | Lazy rendering, virtual scrolling, batched storage operations, performance budget |
| New Tab override conflicts with other extensions | Medium | Medium | Graceful fallback if conflict detected; feature toggle to disable; clear onboarding message |
| Only one extension can override newtab | Low | High | Prominent feature in store listing; offer Minimal mode as lightweight alternative |
| Glassmorphism backdrop-filter performance on low-end hardware | Medium | Medium | Detect GPU capability; auto-disable blur on low-end devices; provide "Performance Mode" toggle |
| User-uploaded wallpapers exceed IndexedDB quota | Low | Medium | Enforce 5MB per image limit; max 10 custom images; storage usage indicator with cleanup |

---

## 19. Future Enhancements

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
- New Tab: Pomodoro timer widget integrated with to-do list
- New Tab: Weather widget with location-based forecast
- New Tab: RSS feed reader widget for news headlines
- New Tab: Notes/scratchpad widget with markdown support
- New Tab: Bookmark analytics — most clicked, least used, broken links detector
- New Tab: Custom CSS injection for advanced theming
- New Tab: Widget marketplace for community-created widgets
- New Tab: Shared boards — collaborate on bookmark collections with team members

---

*End of Document — Session Saver PRD v1.1 — March 2026*
