# Browser Hub — Project Overview

## What Is Browser Hub?

Browser Hub is a **Chrome extension** (Manifest V3) that saves, restores, and manages browser sessions. Beyond basic session management, it replaces the Chrome new tab page with a fully customizable productivity dashboard and provides a persistent side panel for quick access to all features.

The project consists of three surfaces:

| Surface | Purpose | Port |
|---|---|---|
| **Chrome Extension** | Session saving, Start-Tab dashboard, Side Panel | — |
| **Web App** (`web/`) | User-facing dashboard, billing, account management | 3000 |
| **Admin App** (`admin/`) | Internal admin panel for users, stats, tickets | 3001 |

---

## How It Works

### Big Picture

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
│                                                      │
│  ┌──────────┐  ┌───────────┐  ┌─────────────────┐   │
│  │  Popup   │  │ Side Panel│  │  Start Tab (NTP)│   │
│  └────┬─────┘  └─────┬─────┘  └────────┬────────┘   │
│       │               │                 │             │
│       └───────────────┴─────────────────┘            │
│                       │ chrome.runtime.sendMessage    │
│              ┌────────▼────────┐                     │
│              │ Service Worker  │  (background)       │
│              │ (event-listeners│                     │
│              │  auto-save-engine│                    │
│              └────────┬────────┘                     │
│                       │                              │
│         ┌─────────────┴──────────────┐               │
│         │                            │               │
│  ┌──────▼──────┐            ┌────────▼──────┐        │
│  │chrome.storage│           │  IndexedDB    │        │
│  │   .local    │           │(browser-hub v2)│        │
│  └─────────────┘           └───────────────┘        │
└─────────────────────────────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │   Supabase Cloud  │
              │  (auth + tracking)│
              └───────────────────┘
```

### Background Service Worker

The service worker (`src/background/`) is the backbone of the extension:

- **`event-listeners.ts`** — Central message dispatcher. All session mutations (save, update, delete) flow through here. Each mutation calls `guardAction()` before execution and `trackAction()` after.
- **`auto-save-engine.ts`** — Listens for browser events and automatically saves sessions. Supports 7 triggers: `timer`, `shutdown`, `sleep`, `battery`, `network`, `window_close`, `manual`. Each trigger type maintains exactly one pinned auto-save entry (updated in place).
- **`alarms.ts`** — Manages `chrome.alarms` for periodic background tasks (e.g., cloud sync every 15 minutes).
- **`tab-group-restore.ts`** — Handles restoring tab groups with correct colors and collapse states.

### Message Passing

All communication between UI surfaces and the service worker uses a typed discriminated-union `Message` type with **19 action types** defined in `src/core/types/messages.types.ts`:

```typescript
// Example flow: UI → Background → Storage
chrome.runtime.sendMessage({ action: 'SAVE_SESSION', payload: session })
// Background: guardAction() → storage write → trackAction() → reply
```

### Storage Layer

```
Services (business logic)
  │
  ├── IndexedDBRepository<T>          ← sessions (browser-hub v2, isAutoSave/createdAt indexes)
  │
  ├── ChromeLocalKeyAdapter<T>        ← subscriptions, tab-group templates
  │
  ├── NewTabDB (newtabDB singleton)   ← bookmarks, todos, quick links, wallpapers (newtab-db)
  │
  └── chrome.storage.local (direct)  ← settings, auth tokens, plan cache, action usage
```

- **Sessions** → IndexedDB (`browser-hub` v2) via `IRepository<T>` interface
- **Settings** → `chrome.storage.local` via `ChromeStorageAdapter`
- **Subscriptions & Tab-Group Templates** → `chrome.storage.local` flat keys via `ChromeLocalKeyAdapter<T>`
- **Start-Tab data** (bookmarks, todos, wallpapers) → separate IndexedDB (`newtab-db`) via `NewTabDB` singleton
- **No cloud sync of user data** — all storage is local only; Supabase is used for auth and action tracking only

### Action-Based Rate Limiting

Every mutation is gated by two functions in `src/core/services/limits/limit-guard.ts`:

```typescript
await guardAction()   // throws ActionLimitError if daily/monthly limit reached
void trackAction()    // increments counter + fire-and-forget upsert to Supabase
```

| Plan | Daily Limit | Monthly Limit |
|---|---|---|
| Guest | 3 | 20 |
| Free | 6 | 30 |
| Pro | 50 | 500 |
| Lifetime | 90 | 900 |

Guest limits are also fetched dynamically from Supabase at startup and cached in `cached_guest_limits`.

---

## Chrome Extension

### Side Panel (Primary UI)

The side panel is the main interface, opened by clicking the extension icon or pressing `Ctrl+Shift+S`.

**Entry point:** `src/sidepanel/`  
**State:** Zustand store in `src/sidepanel/stores/sidepanel.store.ts`

#### Views

| View | Description |
|---|---|
| `home` | Sessions list, current tabs, tab groups tabs |
| `session-detail` | View/edit a saved session |
| `tab-groups` | Live and saved tab groups management |
| `settings` | User preferences |
| `import-export` | Full data backup and restore |
| `subscriptions` | Subscription tracker (List / Calendar / Analytics) |
| `prompts` | Two-pane AI prompt manager |

#### Key Components
- **`Header.tsx`** — Navigation buttons (Cloud ☁️, Subscriptions 💳, Prompts ✨, Settings ⚙️) + usage limit pill
- **`NavigationStack.tsx`** — Renders the active view based on store state
- **`SessionsPanel`** / **`AutoSavesPanel`** — Virtual-scrolled lists (>30 items use `@tanstack/react-virtual`)
- **`CurrentTabsPanel.tsx`** — Live view of currently open tabs
- **`HomeTabGroupsPanel.tsx`** — Live and saved tab groups with inline editing

#### Keyboard Shortcuts
- `Ctrl+Shift+S` — Open side panel
- `Ctrl+Shift+P` — Navigate to Prompts view
- `Ctrl+Shift+T` — Navigate to Tab Groups view

---

### Start Tab (New Tab Page)

Replaces Chrome's new tab page (`chrome_url_overrides.newtab`) with a customizable productivity dashboard.

**Entry point:** `src/newtab/`  
**State:** Two Zustand stores (`newtab-ui.store.ts` + `newtab-data.store.ts`) with a facade re-export from `newtab.store.ts`

#### Layout Modes
Cycled with `Ctrl+Shift+L`:

| Mode | Description |
|---|---|
| `minimal` | Clean, distraction-free |
| `focus` | Focused work layout |
| `dashboard` | Full widget board |

#### Widget Types (`CardType`)

| Widget | Description |
|---|---|
| `bookmark` | Bookmark category with drag-and-drop entries |
| `clock` | Live clock display |
| `note` | Freeform text note |
| `todo` | Todo list with checkboxes |
| `subscription` | Subscription tracker summary |
| `tab-groups` | Live browser tab groups snapshot |
| `prompt-manager` | AI prompt quick-access panel |

Each widget has configurable min/max/default sizes defined in `src/core/config/widget-config.ts`. The `ResizePopover` enforces these constraints.

#### Top Navigation Tabs
- Quick Links, Frequently Visited, Tabs, Activity

#### Sidebar Panels (lazy-loaded)
Sessions, Auto-Saves, Tab Groups, Import/Export, Subscriptions, Prompts, Cloud Sync, Settings

#### Styling
- Glassmorphism utilities: `.glass` (16px blur), `.glass-panel` (24px blur), `.glass-dark`
- Dark mode via Tailwind `class` strategy
- CSS custom properties: `--newtab-text`, `--newtab-text-secondary`
- Background: `BackgroundLayer` renders behind all content (z-index 0)

#### Drag & Drop
Uses `@dnd-kit/sortable`:
- `horizontalListSortingStrategy` — Quick links
- `verticalListSortingStrategy` — Bookmark entries within a category
- `rectSortingStrategy` — Category grid reordering

---

### Popup

A compact quick-action UI accessible from the Chrome toolbar.

**Entry point:** `src/popup/`

---

## Web App (`web/`)

The user-facing companion web application.

**Stack:** Next.js 16 (canary) · React 19 · Tailwind CSS v4 · shadcn/ui · Supabase SSR  
**Port:** 3000

### Route Groups

| Group | Routes | Description |
|---|---|---|
| `(public)` | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Landing and auth pages |
| `(authenticated)` | `/dashboard`, `/billing`, `/settings`, `/support`, `/suggestions` | Authenticated user pages |

### Pages

- **Dashboard** — Daily/monthly action usage bars fetched via `get_user_plan_tier` + `user_action_usage` Supabase table
- **Billing** — Plan comparison table with action limits, Checkout flow
- **Settings** — Profile / Appearance / Security tabs
- **Support** — Ticket submission (POST `api/support` → inserts to `tickets` table + fires email)
- **Suggestions** — Feature suggestions (POST `api/suggestions` → inserts to `suggestions` table + fires email)

### Auth Flow

Auth emails bypass Supabase's built-in email system:
1. `serviceSupabase.auth.admin.generateLink()` → get token
2. Build redirect URL
3. Call `sendEmail()` via Nodemailer + Resend

**API routes:** `api/auth/sign-in`, `api/auth/sign-up`, `api/auth/forgot-password`, `api/auth/resend-verification`, `api/auth/password-changed`, `api/auth/google`, `api/auth/session`

### Email System

- **Transport:** Nodemailer via Resend SMTP (`smtp.resend.com:465`)
- **9 Templates:** `emailVerification`, `welcome`, `passwordReset`, `passwordResetConfirmation`, `supportTicket`, `featureSuggestion`, `billingNotification`, `invoiceReceipt`, `trialEnding`
- **Base layout:** `lib/email/templates/base.ts` — `wrapInBaseLayout()`, `button()`, `heading()`, `paragraph()`
- **Logging:** All sends (success and failure) logged to `email_log` Supabase table

### Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=        # used in auth redirect URLs and email links
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_FROM_NAME=Browser Hub
SMTP_FROM_EMAIL=info@yourdomain.com
SMTP_SUPPORT_EMAIL=support@yourdomain.com
SMTP_LOGO_URL=               # optional
```

### UI Components

19 shadcn/ui components in `web/components/ui/`. Sidebar uses `SidebarProvider` with 3 collapse modes: expanded / collapsed / hover.

---

## Admin App (`admin/`)

Internal admin panel for managing users, subscriptions, and support.

**Stack:** Next.js 16 (canary) · React 19 · Tailwind CSS v4 · shadcn/ui · Recharts · Supabase (service-role)  
**Port:** 3001  
**SEO:** `robots: noindex, nofollow`

### Pages

| Page | Description |
|---|---|
| Overview | Stats via `get_admin_overview` RPC (total users, sessions, tab groups, etc.) |
| Users | User management and plan tier assignment |
| Statistics | Analytics charts via Recharts |
| Promo Codes | Create and manage discount codes |
| Subscriptions | View user subscription records |
| Webhooks | Webhook configuration and logs |
| Tickets | Support ticket inbox with reply functionality |
| Suggestions | Feature suggestion inbox with reply functionality |
| Quotas | User limit management and usage overrides |
| Emails | Send tab (compose + send via SMTP) + Logs tab (from `email_log`) |

### Admin API Routes

- `api/auth/sign-in` / `api/auth/sign-out` — Admin authentication
- `api/emails/send` — Send email via SMTP
- `api/tickets/[id]/reply` — Insert reply + send `ticketReply` email to ticket owner
- `api/suggestions/[id]/reply` — Update suggestion + send `suggestionReply` email to submitter

### Auth

Admin role checked via Supabase `profiles.role` column. Uses `createServiceClient` (service-role key) for privileged queries. Middleware redirects non-admins to `/login`.

### Email Templates (11 total)

All 9 web templates plus:
- `ticketReply` — Sent to user when admin replies to a support ticket
- `suggestionReply` — Sent to user when admin replies to a feature suggestion

### Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_FROM_NAME=Browser Hub
SMTP_FROM_EMAIL=info@yourdomain.com
SMTP_SUPPORT_EMAIL=support@yourdomain.com
```

---

## Technologies & Languages

### Languages

| Language | Used In |
|---|---|
| **TypeScript** | Extension, web app, admin app — all surfaces |
| **CSS** | Tailwind utility classes + CSS custom properties for theme tokens |
| **SQL** | Supabase migrations (`supabase/migrations/`) |

### Extension

| Category | Technology | Version |
|---|---|---|
| Framework | React | 18.3 |
| Build | Vite + `@crxjs/vite-plugin` | 6.0 |
| Styling | Tailwind CSS | 3.4 |
| State | Zustand | 5.0 |
| UI Primitives | Radix UI | 1.1–2.2 |
| Backend/Auth | Supabase JS | 2.100 |
| Drag & Drop | @dnd-kit | 6.x |
| Virtual Scroll | @tanstack/react-virtual | 3.13 |
| Icons | Lucide React | 0.469 |
| Testing | Vitest + jsdom | 3.0 |
| Linting | ESLint | 9.18 |
| Formatting | Prettier | 3.4 |

### Web & Admin Apps

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.2 (canary) |
| React | React | 19.2 |
| Styling | Tailwind CSS | 4.2 |
| UI | shadcn/ui + Radix UI | latest |
| Auth/DB | Supabase SSR | latest |
| Email | Nodemailer + Resend | 6.9 |
| Charting (admin) | Recharts | 2.15 |
| Validation | Zod | 4.3 |
| Notifications | Sonner | latest |

---

## Features at a Glance

| Feature | Extension | Web | Admin |
|---|---|---|---|
| Session save / restore / delete | ✅ | — | — |
| Auto-save (7 triggers) | ✅ | — | — |
| Tab groups (live + saved) | ✅ | — | — |
| Bookmark manager | ✅ (start-tab) | — | — |
| Todo lists | ✅ (start-tab) | — | — |
| Subscription tracker | ✅ | — | — |
| AI prompt manager | ✅ | — | — |
| Weather widget | ✅ (start-tab) | — | — |
| Import / Export | ✅ | — | — |
| User authentication | ✅ (Supabase) | ✅ | ✅ |
| Action rate limiting | ✅ | — | ✅ (manage) |
| Billing / plan upgrade | — | ✅ | ✅ (manage) |
| Support tickets | — | ✅ (submit) | ✅ (reply) |
| Feature suggestions | — | ✅ (submit) | ✅ (reply) |
| Transactional email | — | ✅ | ✅ |
| Analytics / statistics | — | ✅ (own usage) | ✅ (all users) |
| Promo codes | — | — | ✅ |
| User quota overrides | — | — | ✅ |

---

## Key Files Reference

### Extension Core

| File | Purpose |
|---|---|
| `public/manifest.json` | Chrome MV3 manifest — permissions, entry points, shortcuts |
| `src/core/types/session.types.ts` | Session, Tab, TabGroup, AutoSaveTrigger types |
| `src/core/types/limits.types.ts` | PlanTier, PLAN_LIMITS, ActionUsage, LimitStatus |
| `src/core/types/messages.types.ts` | 19-action message protocol between SW and UI |
| `src/core/services/limits/limit-guard.ts` | `guardAction()` + `trackAction()` — rate limit enforcement |
| `src/core/services/limits/action-tracker.ts` | `getActionUsage()`, `getLimitStatus()`, `cachePlanTier()` |
| `src/core/services/auth.service.ts` | Supabase auth wrapper + plan tier fetch on sign-in |
| `src/core/services/guest.service.ts` | `getOrCreateGuestId()` for anonymous usage tracking |
| `src/core/config/widget-config.ts` | `WIDGET_CONFIG` registry — widget min/max/default sizes |
| `src/core/storage/indexeddb-repository.ts` | `IndexedDBRepository<T>` — session persistence |
| `src/core/storage/chrome-local-key-adapter.ts` | `ChromeLocalKeyAdapter<T>` — generic `chrome.storage.local` arrays |
| `src/core/storage/newtab-storage.ts` | `NewTabDB` singleton — start-tab data (bookmarks, todos, wallpapers) |

### Background

| File | Purpose |
|---|---|
| `src/background/event-listeners.ts` | Central message dispatcher with guard+track on mutations |
| `src/background/auto-save-engine.ts` | Auto-save trigger management (7 trigger types) |
| `src/background/alarms.ts` | `chrome.alarms` setup and handling |

### Side Panel

| File | Purpose |
|---|---|
| `src/sidepanel/App.tsx` | Root component + keyboard shortcuts |
| `src/sidepanel/stores/sidepanel.store.ts` | Zustand store + `SidePanelView` union |
| `src/sidepanel/components/NavigationStack.tsx` | View renderer |
| `src/sidepanel/views/HomeView.tsx` | Sessions / Current Tabs / Tab Groups tabs |
| `src/sidepanel/views/PromptsView.tsx` | Two-pane prompt manager |
| `src/sidepanel/views/SubscriptionsView.tsx` | Subscription List / Calendar / Analytics |

### Start Tab

| File | Purpose |
|---|---|
| `src/newtab/App.tsx` | Root component — data loading, layout selection |
| `src/newtab/layouts/DashboardLayout.tsx` | Full dashboard layout with `isSessionView` split |
| `src/newtab/components/BookmarkCategoryCard.tsx` | Widget host — dispatches to body components |
| `src/newtab/components/SessionsPanel.tsx` | Virtual-scrolled sessions sidebar |
| `src/newtab/contexts/BookmarkBoardContext.tsx` | Board-level actions context (no prop drilling) |

### Web App

| File | Purpose |
|---|---|
| `web/lib/email/send.ts` | `sendEmail()` — Nodemailer send + `email_log` insert |
| `web/lib/email/templates/base.ts` | Base HTML layout for all email templates |
| `web/app/(authenticated)/dashboard/page.tsx` | Usage bars dashboard |
| `web/app/(public)/login/page.tsx` | Email/password + Google OAuth login |

### Admin App

| File | Purpose |
|---|---|
| `admin/app/(admin)/overview/page.tsx` | Stats overview via `get_admin_overview` RPC |
| `admin/app/(admin)/users/page.tsx` | User management |
| `admin/app/(admin)/emails/EmailSendForm.tsx` | Email compose + send UI |
| `admin/app/api/tickets/[id]/reply/route.ts` | Reply to support ticket + send email |

---

## Development Commands

### Extension (root)

```bash
npm run dev          # Vite dev server with HMR
npm run build        # tsc type-check + Vite production build → dist/
npm test             # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
npm run format       # Prettier
```

### Web App

```bash
cd web && npm install && npm run dev    # Start on port 3000
cd web && npm run build                 # Production build
```

### Admin App

```bash
cd admin && npm install && npm run dev  # Start on port 3001
cd admin && npm run build               # Production build
```

---

## Testing

- **661+ tests** across 65 files in `tests/unit/`
- **Framework:** Vitest 3.0 + jsdom
- **Chrome APIs** mocked globally in `tests/setup.ts`
- Services that use `guardAction`/`trackAction` must mock `@core/services/limits/limit-guard`:

```typescript
vi.mock('@core/services/limits/limit-guard', () => ({
  guardAction: vi.fn().mockResolvedValue(undefined),
  trackAction: vi.fn().mockResolvedValue(undefined),
  ActionLimitError: class ActionLimitError extends Error {},
}))
```

---

## Internationalization

Three locales in `_locales/`:
- `en/messages.json` — ~282 keys (primary)
- `ar/messages.json` — Arabic
- `de/messages.json` — German

All translations accessed via `t()` wrapper at `src/shared/utils/i18n.ts`.
