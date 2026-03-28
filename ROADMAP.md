# Browser Hub — Project Roadmap

A living document covering everything built so far and all possible directions forward.

---

## What We've Built

### Extension Core
| Feature | Status | Key Files |
|---|---|---|
| Session save / restore | Done | `src/background/`, `src/core/storage/indexeddb.ts` |
| Auto-save engine | Done | `src/background/auto-save-engine.ts` |
| Tab Groups (live + saved templates) | Done | `src/sidepanel/views/TabGroupsView.tsx`, `src/newtab/components/TabGroupsPanel.tsx` |
| Subscription tracker | Done | `src/sidepanel/views/SubscriptionsView.tsx`, `src/newtab/components/SubscriptionCardBody.tsx` |
| Prompt manager | Done | `src/sidepanel/views/PromptsView.tsx`, `src/newtab/components/PromptsPanel.tsx` |
| Cloud sync (Supabase) | Done | `src/core/services/sync.service.ts`, `src/core/supabase/client.ts` |
| Cloud sync login in new-tab dashboard | Done | `src/newtab/components/CloudSyncPanel.tsx`, `src/newtab/components/DashboardSidebar.tsx` |
| Sidepanel header auth status dot | Done | `src/sidepanel/components/Header.tsx` |
| Start-tab (3 layout modes) | Done | `src/newtab/` — minimal, focus, dashboard |
| Widget system (6 types) | Done | bookmark, clock, note, todo, subscription, tab-groups |
| Widget resize + size constraints | Done | `src/core/config/widget-config.ts`, `src/newtab/components/ResizePopover.tsx` |
| Virtual scrolling (sessions panel) | Done | `@tanstack/react-virtual` v3, threshold >30 items |
| i18n (EN / AR / DE) | Done | `_locales/`, `src/shared/utils/i18n.ts` |
| Error boundaries | Done | `src/shared/components/ErrorBoundary.tsx` |
| 256 unit tests | Done | `tests/unit/` across 21 files |

### Backend (Supabase)
| Item | Status | Notes |
|---|---|---|
| 11 SQL migrations | Done | `supabase/migrations/001–011.sql` |
| Auth + profiles | Done | `profiles` table, role column |
| Plans + user_plans | Done | free / pro / max tiers |
| Promo codes | Done | `promo_codes` table |
| Sessions sync table | Done | RLS per user |
| Prompts + prompt_folders sync | Done | RLS per user |
| Tracked subscriptions sync | Done | RLS per user |
| Quota RPC | Done | `get_user_quota(p_user_id)` |
| Admin tables | Done | `admin_events`, `support_tickets`, `suggestions`, `webhooks` |
| Row-level triggers | Done | auto-update `updated_at` |

### Web App (`web/` — Next.js 16, port 3000)
| Page | Status | Notes |
|---|---|---|
| Login (email + Google OAuth) | Done | `web/app/(public)/login/` |
| Register (password strength meter) | Done | `web/app/(public)/register/` |
| Forgot password + verify email | Done | `web/app/(public)/forgot-password/` |
| Dashboard | Done | reads live Supabase data |
| Billing page (plan comparison UI) | Done | plan table, quota rows, Upgrade buttons |
| Settings (Profile / Appearance / Security) | Done | 3 tabs, Supabase writes |
| Support | Done | ticket submission |
| Suggestions | Done | user feedback |
| Auth middleware + route protection | Done | `web/middleware.ts` |
| API routes (auth) | Done | sign-in, sign-up, forgot-pw, Google, session |
| Cookie-based dark/light/system theme | Done | FOUC-safe inline script |
| 19 shadcn/ui components | Done | `web/components/ui/` |

### Admin App (`admin/` — Next.js 16, port 3001)
| Page | Status | Notes |
|---|---|---|
| Login (admin-only) | Done | role check via `profiles.role` |
| Overview | Done | `get_admin_overview` RPC |
| Users | Done | list + search |
| Statistics | Done | aggregated metrics |
| Promo Codes | Done | list view (read-only) |
| Subscriptions | Done | list view |
| Webhooks | Done | list view |
| Tickets | Done | support ticket list |
| Suggestions | Done | user suggestion list |
| Quotas | Done | per-user quota view |
| Emails | Done | email log view |
| Service-role Supabase client | Done | bypasses RLS for admin queries |

---

## What We Can Do Next

### High Priority

#### 1. Stripe Billing Integration (Web App)
The billing page has a full plan comparison table and "Upgrade" buttons that link to `/checkout?plan=X` — but the route doesn't exist yet. This is the biggest functional gap.

**What to build:**
- `web/app/(authenticated)/checkout/page.tsx` — billing cycle picker (monthly / yearly, ~20% savings) + redirect to Stripe Checkout
- `web/lib/stripe.ts` — Stripe SDK singleton
- `web/app/api/stripe/create-checkout/route.ts` — creates a Stripe Checkout Session
- `web/app/api/stripe/portal/route.ts` — opens Stripe Customer Portal (manage subscription, update card, cancel)
- `web/app/api/webhooks/stripe/route.ts` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → writes to `user_plans` table
- Add `.env` keys: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Add Stripe product/price IDs to plans table or env vars
- Update billing page: show "Manage Subscription" button (→ portal) when user has `stripe_subscription_id`

#### 2. Quota Enforcement in the Extension
The extension currently syncs everything regardless of plan limits. `getUserQuota()` is called but the limits aren't enforced.

**What to build:**
- In `sync.service.ts`: before upserting sessions, check `quota.sessions_synced_limit` and truncate to limit
- Same for prompts, folders, subscriptions
- Surface "quota reached" state in `CloudSyncPanel.tsx` and `CloudSyncView.tsx` — show a warning banner when at or near limit
- Show quota bars as percentage filled (already has `QuotaBar` component — just needs limit enforcement upstream)
- Add upgrade CTA in extension when quota is hit (link to `https://browserhub.app/billing`)

#### 3. Admin App Write Operations
All admin pages are read-only. Admins can't take any action yet.

**What to build:**
- Promo Codes: create form (code, discount %, expiry, max uses), deactivate button
- Users: change plan, suspend/unsuspend account, impersonate (generate magic link)
- Tickets: reply to ticket, change status (open / in-progress / resolved / closed)
- Suggestions: mark as reviewed, upvote, link to release
- Webhooks: add endpoint, toggle active, view recent delivery logs
- Emails: resend failed email
- Quotas: manual override for a user's quota limits

---

### Medium Priority

#### 4. Extension: Import from Browser (Chrome Sync / Bookmarks)
Allow users to import their existing Chrome bookmarks or history into the start-tab bookmark board.

- Use the `bookmarks` permission (already in manifest) to read `chrome.bookmarks.getTree()`
- UI: "Import from Chrome Bookmarks" button in Import/Export view or sidebar
- Map Chrome bookmark folders → BookmarkCategory, bookmark entries → BookmarkEntry

#### 5. Extension: Session Search
Add full-text search across saved sessions (session name, tab titles, URLs).

- Search input in the sessions panel (sidepanel + start-tab)
- Filter sessions by keyword in real time — search across tab titles and URLs
- Add search index on session data in IndexedDB or filter client-side with debounce

#### 6. Extension: Session Tags / Labels
Let users tag sessions (e.g. "work", "research", "shopping") for filtering.

- Add `tags: string[]` field to `Session` type
- Tag picker in session save/edit flow
- Filter sessions by tag in SessionsPanel
- Show tag chips on session cards

#### 7. Extension: Browser History Widget (Start-Tab)
A new widget type showing recent browser history, powered by the optional `history` permission.

- New `CardType`: `'history'`
- Request `history` permission on first use (already listed as `optional_permissions` in manifest)
- `HistoryCardBody.tsx` — shows recent tabs as a searchable list
- Add to `WIDGET_CONFIG`, `AddCardModal`, `DashboardLayout`, `FocusLayout`

#### 8. Extension: Keyboard Command Palette
A `Cmd+K` / `Ctrl+K` style command palette in the sidepanel.

- Fuzzy-search across sessions, prompts, tab groups, subscriptions, navigation actions
- Keyboard-first: arrow keys to navigate, Enter to activate, Escape to close
- Actions: "Save current session", "Open session X", "Copy prompt Y", "Go to Subscriptions"

#### 9. Web App: Landing Page
Currently `/` redirects authenticated users to dashboard and unauthenticated users to login. There's no public marketing/landing page.

- Feature highlights, pricing section (mirrors billing page plans), testimonials
- "Add to Chrome" CTA button
- SEO meta tags + Open Graph
- Responsive design

#### 10. Web App: Promo Code Redemption
Users can't apply promo codes to their accounts yet.

- Input field on the billing / checkout page: "Have a promo code?"
- `web/app/api/stripe/apply-promo/route.ts` — validates code in `promo_codes` table, applies Stripe coupon
- Decrement `times_used` on redemption, enforce `max_uses` and `expires_at`

#### 11. Web App: Email Notifications
Triggered emails for key events.

- Welcome email after signup
- Subscription renewal reminder (7 days before)
- Payment failed notice
- Quota nearing limit warning (at 80%)
- Use Resend / SendGrid / Supabase Edge Functions + email templates

---

### Lower Priority / Polish

#### 12. Extension: Prompt Variable Templates Library
Pre-built prompt templates with `{{variable}}` placeholders for common use cases (code review, summarize, explain, translate).

- Ship as "App Prompts" (`source: 'app'`) seeded on install
- Grouped by category: Writing, Coding, Research, Productivity

#### 13. Extension: Subscription CSV Import
Allow bulk-importing subscriptions from a CSV file (already has export — complete the round trip).

- `SubscriptionService.importFromCSV()` already exists
- Add "Import CSV" button to SubscriptionsView with file picker + validation UI

#### 14. Extension: Dark/Light Theme Toggle
The start-tab uses wallpaper-based theming; the sidepanel follows system preference. Add an explicit toggle.

- Settings panel toggle: System / Light / Dark
- Persist to `newtab_settings`
- Apply via `document.documentElement.classList` — the Tailwind `class` strategy is already configured

#### 15. Extension: Focus Mode Enhancements
The "Focus" layout mode is minimal. Could be enhanced with:

- Pomodoro timer widget
- Goal-of-the-day text field
- Block-list integration (hide distracting sites from quick links during focus)

#### 16. Web App: Dashboard Data Visualizations
The dashboard page reads Supabase data but the visuals are basic. Add charts:

- Session saves over time (line chart)
- Most-used tab groups (bar chart)
- Subscription spend by category (pie chart)
- Use inline SVG approach (project convention — no chart library)

#### 17. Extension: Sync Conflict Resolution
When the same session is modified both locally and remotely (e.g. two devices), the current push-first strategy silently overwrites. Add:

- Last-write-wins with `updated_at` timestamp comparison
- Optional: conflict diff modal (similar to existing `SessionDiffModal.tsx`)

#### 18. Extension: PWA Companion App
A minimal Progressive Web App version of the sidepanel for mobile / non-Chrome browsers.

- Read-only access to synced sessions and prompts
- Uses the same Supabase backend
- Hosted at `app.browserhub.app` or as a route in the existing `web/` app

#### 19. Admin App: Analytics Dashboard
Aggregated charts showing growth, revenue, and engagement metrics.

- New signups per day / week / month
- Plan conversion funnel (free → pro → max)
- Most active users, most-saved sessions count
- Revenue MRR trend (from Stripe webhooks data stored in DB)

#### 20. Admin App: Broadcast Emails
Send announcements to all users or filtered segments (e.g. pro plan only, inactive 30+ days).

- Compose UI with subject + body (rich text)
- Recipient filter: all / plan tier / last active date range
- Preview + send via email provider API

---

## Tech Debt / Infrastructure

| Item | Notes |
|---|---|
| E2E tests | No Playwright/Cypress tests yet — only unit tests |
| Extension store listing | Chrome Web Store listing, screenshots, privacy policy |
| CI/CD pipeline | No GitHub Actions yet — build + test on push |
| Error monitoring | No Sentry or similar — uncaught errors are silent in production |
| Rate limiting | API routes have no rate limiting — add for auth endpoints especially |
| GDPR / data export | Users can't download or delete all their data yet |
| Extension auto-update notifications | No in-extension changelog or "what's new" after updates |
