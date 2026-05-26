# Day Coordinator — Copilot Context

## Product Vision

Full product vision, data model, phase strategy, and UX principles are documented in `docs/VISION.md`.
Read it before making architectural decisions or adding new models/screens.

## System Overview

Day Coordinator is a day-of coordination and scheduling platform for weddings and events.
It provides real-time task management, timeline visualization, vendor coordination,
and live-mode tracking during an event.

## Mobile-First Development Rule

**All new features must be built mobile-first.**

- Default Tailwind styles target 375px mobile. Use `sm:` / `md:` / `lg:` for larger viewports.
- Navigation pattern: bottom tab bar on mobile (`sm:hidden`), left sidebar on desktop (`hidden sm:flex`).
- Touch targets ≥ 44×44px. Single-column stacked layouts default; grid at `sm:` or wider.
- Live Mode is a primary mobile use case — coordinators hold phones during events.

## Onboarding Rule

- New users are redirected to `/onboarding` after the auth callback until `User.onboarded = true`.
- Onboarding collects `firstName` (required), `lastName` (required), `company` (optional), `phone` (optional).
- Phone is stored E.164 (`+1XXXXXXXXXX`). Display format: `(XXX) XXX-XXXX`.
- The dashboard layout enforces the onboarding gate — redirects to `/onboarding` if `!dbUser.onboarded`.

## Authentication Rules

- **Email magic link is the only sign-in method.** SMS OTP auth has been deliberately removed.
- Phone numbers are collected **post-login** on the user profile — used for SMS notifications only, never for auth.
- Magic link route (`/api/auth/magic-link`) is IP rate-limited: 3 requests per 15 minutes per IP.
- Auth redirects must use `request.headers.get("origin")` — never hardcode `NEXT_PUBLIC_APP_URL`.
- Proxy/middleware lives in `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`). Export must be named `proxy`.

## Data Model Rules

- **All data is event-scoped.** Every model includes an `eventId` foreign key.
- Tasks form a **dependency DAG with a single-parent rule** — each task may have at most one `parentTaskId`.
- **No circular dependencies allowed.** Enforce at write time in API routes.
- Scheduling is **computed** from dependencies and durations — never manually authoritative unless `manualOverride = true`.
- When `manualOverride = true`, propagation of schedule changes to child tasks is **disabled**.
- **Live mode** is triggered by the first task start (`Task.actualStart` set → `Event.status = LIVE`, `Event.liveStartedAt` set).

## Scheduling Invariants

1. `scheduledStart` of a task = `scheduledEnd` of its parent (if parent exists).
2. `scheduledEnd` = `scheduledStart` + `durationMins`.
3. Manual overrides (`manualOverride = true`) break the propagation chain — do not recalculate children.
4. Delays must be propagated downstream through the DAG unless a child has `manualOverride = true`.

## Real-Time Event Contract

All state-changing operations must emit a Supabase Realtime broadcast via `src/lib/realtime/index.ts`.
Never emit directly — always go through `emitEventUpdate(eventId, eventName, data)`.

| Action         | Event Name       |
| -------------- | ---------------- |
| Task created   | `task.created`   |
| Task updated   | `task.updated`   |
| Task started   | `task.started`   |
| Task completed | `task.completed` |
| Task delayed   | `task.delayed`   |

Channel naming: `event-{eventId}`

## Notification System Rules

- `src/app/api/auth/sms/route.ts` is kept for notification dispatch — do **not** use it for authentication.
- All sends must be **idempotent** — check `NotificationStatus` before sending.
- Use `sendNotification(id)` from `src/lib/notifications/index.ts` — never dispatch directly from API routes.
- Never send a notification without checking `NotificationStatus` first.

## Database Rules

- **Never remove fields** from existing models — only extend with nullable columns.
- **Prefer nullable columns** over restructuring existing tables.
- Use `ActivityLog` for all audit trail, history, and rollback analysis.
- Every schema migration must have a corresponding `ActivityLog` action string defined.
- Run `prisma generate` after any schema change. The `postinstall` script handles this automatically on deploy.

## Architecture Boundaries

- **DAG logic lives in the backend only** — never compute dependencies in the UI.
- **Scheduling computation lives in `/lib/scheduler`** — not in API routes or components.
- **Real-time emission lives in `/lib/realtime`** — not scattered in API handlers.
- **Payment logic lives in `/lib/payments`** — no Stripe calls outside this module.
- **Notification dispatch lives in `/lib/notifications`** — use the queue, never call directly.

## Event-Scoping Rule

Every database query that reads or writes event-related data MUST include a WHERE clause
filtering by `eventId`. Never return data that isn't scoped to the current event context.

## ActivityLog Actions (canonical strings)

```
task.created
task.updated
task.started
task.completed
task.delayed
task.skipped
event.created
event.updated
event.live_started
event.completed
notification.sent
notification.failed
```

## UI Component System

### Stack

- **shadcn/ui** (Nova preset, Radix-based) — pre-built components live in `src/components/ui/`
- **Tailwind v4** — CSS-first config, no `tailwind.config.js`. All tokens defined in `src/app/globals.css`
- **next-themes** — dark/light mode via `class="dark"` on `<html>`. Provider is in `src/components/providers/theme-provider.tsx`
- **Lucide React** — icon library (`lucide-react`)
- **`cn()` utility** — always use `cn()` from `src/lib/utils.ts` to merge classes

### Adding shadcn Components

Run `npx shadcn@latest add <component>` to add new pre-built components. They land in `src/components/ui/` already wired to the brand tokens.

### Theming Rules

- **Never use hardcoded colors** (`#fff`, `text-red-500`, etc.) — always use semantic token classes
- **Never write a `.dark` CSS block manually** — dark values are already defined in `globals.css`; use `dark:` Tailwind utilities only for structural differences (layout, opacity, visibility)
- Dark mode is class-based. The `dark:` utility prefix works automatically when `class="dark"` is on `<html>`

### Color Token Reference

| Tailwind Class                               | Usage                                |
| -------------------------------------------- | ------------------------------------ |
| `bg-background` / `text-foreground`          | Page background and body text        |
| `bg-card` / `text-card-foreground`           | Cards, panels, surfaces              |
| `bg-popover` / `text-popover-foreground`     | Dropdowns, modals, tooltips          |
| `bg-primary` / `text-primary-foreground`     | Primary CTA buttons, key actions     |
| `bg-secondary` / `text-secondary-foreground` | Secondary buttons, neutral surfaces  |
| `bg-accent` / `text-accent-foreground`       | Coral highlight, emphasis elements   |
| `bg-muted` / `text-muted-foreground`         | Subtle backgrounds, placeholder text |
| `border-border`                              | Default borders and dividers         |
| `ring-ring`                                  | Focus rings                          |
| `bg-hover`                                   | Hover state overlays                 |
| `bg-active`                                  | Active / selected state backgrounds  |
| `bg-disabled` / `text-disabled-foreground`   | Disabled elements                    |

#### Status Colors

| Class                                            | Meaning               |
| ------------------------------------------------ | --------------------- |
| `bg-success` / `text-success-foreground`         | Confirmed, on-track   |
| `bg-warning` / `text-warning-foreground`         | Pending, at-risk      |
| `bg-destructive` / `text-destructive-foreground` | Error, delete, danger |
| `bg-info` / `text-info-foreground`               | Informational         |

#### Scheduling / Calendar Colors

| Class               | Usage                          |
| ------------------- | ------------------------------ |
| `bg-event-personal` | Personal tasks                 |
| `bg-event-client`   | Client-facing meetings         |
| `bg-event-vendor`   | Vendor / external coordination |
| `bg-event-deadline` | Hard deadlines                 |
| `bg-event-travel`   | Travel and logistics           |
| `bg-event-blocked`  | Blocked / unavailable time     |

### Component Location Conventions

| Path                        | Contents                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| `src/components/ui/`        | shadcn/ui primitives and shared design-system atoms (Button, Card, Badge, etc.) |
| `src/components/event/`     | Event-scoped feature components                                                 |
| `src/components/timeline/`  | Timeline and scheduling UI components                                           |
| `src/components/providers/` | Context providers (ThemeProvider, QueryProvider, etc.)                          |

### Key Shared Components

- **`<Button>`** — `src/components/ui/button.tsx`. Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `default`, `sm`, `lg`, `icon`, `xs`
- **`<ThemeToggle>`** — `src/components/ui/theme-toggle.tsx`. Drop-in sun/moon toggle; requires no props
- **`<Logo>`** — `src/components/ui/logo.tsx`. Props: `width`, `height`, `className`. Renders `public/logo.svg`

### CSS Variable Access in Arbitrary Values

When Tailwind utilities don't cover a use case, reference tokens directly:

```tsx
// Correct — use CSS variable with hsl()
style={{ color: "hsl(var(--primary))" }}

// Wrong — never hardcode
style={{ color: "#c0607a" }}
```
