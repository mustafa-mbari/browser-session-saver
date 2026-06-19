# Chrome Web Store — Browser Hub Listing

## Single Purpose
```
Save, restore, and manage browser sessions and tab groups.
```

This satisfies Chrome's single-purpose policy: every feature in the extension (auto-save, tab groups, new-tab dashboard, prompt manager, subscription tracker) serves the same core goal — helping users organise and protect the tabs and work they have open in their browser. The extension does not change search providers, inject ads, or perform any function unrelated to tab/session management.

---

## Are you using remote code?
**No.**

All JavaScript and CSS is bundled at build time by Vite/CRXJS and shipped inside the extension package. The extension does **not** use `eval()`, `new Function()`, `importScripts()` with a remote URL, or any `<script src="https://...">`. The Content Security Policy in the manifest enforces this:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

Network requests are made only to fetch *data* (weather forecasts, authentication tokens, usage counters) — never to load executable code.

---

## Short Description (132 chars max)
```
Save, restore, and manage browser sessions with one click. Auto-save protects tabs before shutdown, sleep, or low battery.
```
*(122 characters)*

---

## Detailed Description

Browser Hub is an all-in-one Chrome side panel that keeps your browser organised and your work protected. It replaces the new-tab page with a productivity dashboard and gives you a persistent panel for managing every aspect of your browsing.

### Session Saving
Capture every open window, tab, and tab group in a single click. Each saved session is named, timestamped, and stored entirely on your device — nothing is uploaded to a server. Restore any session in full, or pick individual tabs to reopen.

### Auto-Save Engine
Never lose your work again. Browser Hub watches for shutdown signals, system sleep, extended idle time, and low battery events, then silently creates an auto-save snapshot before Chrome closes. Each trigger type maintains its own pinned entry that is updated in place — your auto-save list stays clean.

### Tab Groups
Save Chrome tab groups as named templates. Restore your complete tab-group context — colours, names, and URLs — with a single click. Works alongside live groups so you can save a session and its groups together.

### Start-Tab Dashboard
Replace your new-tab page with a customisable productivity hub. Add widgets for bookmarks, your Chrome bookmarks tree, sticky notes, to-do lists, quick links, a clock, a live weather forecast, recent downloads, subscriptions, tab groups, and AI prompts. Three layout modes (Minimal, Focus, Dashboard) adapt to how you work. Drag cards to rearrange; resize them to fit your screen.

### Prompt Manager
Store AI prompt templates with `{{variable}}` placeholders. Organise prompts into folders and sections, pin your favourites, and copy any prompt to the clipboard with one click. Variable slots are filled in a modal before copying — no more editing prompts in the AI chat box.

### Subscription Tracker
Track recurring bills directly on your new-tab page. Colour-coded urgency alerts surface renewals before they happen. Supports multiple currencies and custom billing cycles.

---

**Privacy first.** All session data, bookmarks, notes, to-dos, and subscriptions are stored exclusively in your browser using chrome.storage.local and IndexedDB. Nothing leaves your device unless you sign in or enable optional features (weather widget, prompt sharing).

**Works without an account.** Every feature is available as a guest. Creating a free account unlocks higher daily/monthly action limits and cross-device sign-in.

---

## Privacy Policy URL
https://bh.mbari.de/privacy

---

## Permission Justifications

Paste each entry into the corresponding field in the Chrome Web Store developer dashboard.

### tabs
> Required to read tab URLs and titles when saving a session. The extension captures all open tabs and windows to create a session snapshot that can be restored later. Tab data is stored locally on the user's device only.

### tabGroups
> Required to read, create, and restore Chrome tab groups. When a session is restored, the extension recreates all grouped tabs with their original colour, name, and member tabs.

### storage
> Required to persist extension settings, action-usage counters, plan tier, and cached data in chrome.storage.local. All user data is stored on-device; nothing is synced to external servers without explicit user action.

### alarms
> Required to schedule periodic auto-saves. A chrome.alarms entry fires on a user-configurable interval and wakes the background service worker to create an auto-save snapshot of open tabs.

### idle
> Required to detect when the user has stepped away from the computer. When the idle threshold is reached, an auto-save snapshot is created so that tabs are protected if the system sleeps or powers off unexpectedly.

### sidePanel
> Required to render the extension's primary UI in Chrome's built-in Side Panel. The Side Panel is the main interface for saving, viewing, restoring, and managing sessions.

### bookmarks
> Required to read the browser's native bookmark tree and display bookmarks in the new-tab dashboard. Users can browse and open bookmarks from the extension's start-tab without navigating away.

### downloads
> Required for the "Recent Downloads" widget on the new-tab dashboard. The widget calls `chrome.downloads.search` to list the user's most recent downloads so they can be re-opened directly from the dashboard. (Note: exporting sessions/data as JSON uses an in-page blob link and does NOT rely on this permission.)

### downloads.open
> Required so the user can click an item in the "Recent Downloads" widget to open that file in its default application (`chrome.downloads.open`) or reveal it in its folder (`chrome.downloads.show`), without leaving the new-tab dashboard.

---

### Host Permission Justifications

### https://api.open-meteo.com/*
> Required for the optional weather widget on the new-tab dashboard. The extension sends GPS coordinates (or a city name derived from the IP fallback) to Open-Meteo's free forecast API. No personal data is stored by the extension or transmitted to our servers.

### https://ipinfo.io/*
> Required as a geolocation fallback for the weather widget when the user has not granted GPS permission. The request returns an approximate city name used only to build the weather forecast query. No data is stored server-side by this extension.

### https://*.supabase.co/*
> Required for optional user authentication and plan-tier enforcement. Users who choose to create an account have their email address and daily/monthly action-usage counters synced to Supabase. Guest users remain fully anonymous — only a random UUID and aggregate action counts are reported.

### https://bh.mbari.de/*
> Required for the optional prompt-sharing feature. When a user clicks "Share" on a prompt, the prompt title and content are sent to the Browser Hub web app to generate a public shareable link. No other data is transmitted to this host.

---

## Notes for Reviewer (Testing Instructions)

Paste this into the **"Notes for reviewer"** / testing-instructions field on the submission page. Several permissions power optional new-tab **widgets** that are hidden until the user adds them — these steps exercise every requested permission so they can be observed in use:

1. **Open a new tab** — the extension overrides the new-tab page with its dashboard.
2. **Switch to Dashboard layout** — press `Ctrl+Shift+L` until the multi-widget grid appears.
3. **Add widgets** — click the **+ / Add Card** button and add each of the following:
   - **Weather** — on first render it derives an approximate location via `https://ipinfo.io/json`, then fetches the forecast from `https://api.open-meteo.com` (the two weather host permissions). No data is stored.
   - **Recent Downloads** — calls `chrome.downloads.search` to list recent downloads; clicking an item uses `chrome.downloads.open` / `chrome.downloads.show` (the `downloads` / `downloads.open` permissions).
   - **Chrome Bookmarks** — calls `chrome.bookmarks.getTree` to render the native bookmark tree (`bookmarks` permission).
4. **Prompt sharing** (`https://bh.mbari.de/*`) — open the **Prompts** view, select any prompt, and click **Share**; the prompt title/content is POSTed to the Browser Hub web app to generate a public link.
5. **Sessions, tab groups & auto-save** (`tabs`, `tabGroups`, `alarms`, `idle`, `storage`, `sidePanel`) — open the Side Panel (toolbar icon or `Ctrl+Shift+S`) and click **Save** to capture all open tabs and groups; auto-save is scheduled via `chrome.alarms` and the `chrome.idle` listener.
6. **Account / usage sync** (`https://*.supabase.co/*`) — optional: sign in from the Account screen to see daily/monthly usage counters sync.

All user data is stored locally (`chrome.storage.local` + IndexedDB). Network requests fetch *data* only — no remote code is executed (CSP: `script-src 'self'`).
