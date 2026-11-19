# Notification System — Architecture & Implementation

> **Status:** All phases complete ✅  \n> **Last updated:** 2026-07-07 — Immediate dispatch + unified cron refactor

---

## Overview

Multi-channel notification system for Day Coordinator: PWA installability, Web Push for background delivery, SMS via Twilio, email via Resend, and a single unified cron for time-based checks.

### Channels

| Channel          | Use Case                                | Delivery Mechanism                                                                 |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| **In-App (PWA)** | App is open                             | Supabase Realtime Broadcast → toast                                                |
| **Web Push**     | App closed or backgrounded              | `@pushforge/builder` → browser push service → service worker → system notification |
| **SMS**          | Anytime, phone not required to have app | Twilio REST API → cellular network                                                 |
| **Email**        | Vendor invites (separate system)        | Resend (bypasses Notification table)                                               |

---

## Architecture

```
┌── ACTION-BASED (API Routes) ──────────────────────────────────┐
│                                                                │
│  1. createNotification() → PENDING row (audit + idempotent)    │
│  2. sendNotification(id) — fire-and-forget, no await           │
│     Success → row marked SENT                                  │
│     Failure → row stays PENDING, cron retries in ≤60s           │
│                                                                │
│  Triggers: TASK_STARTED, TASK_COMPLETED, TASK_UNBLOCKED,       │
│            TASK_DELAYED, VENDOR_ACCEPTED                       │
└────────────────────────────────────────────────────────────────┘

┌── CRON-BASED (every 1 minute) ────────────────────────────────┐
│  GET /api/cron/send-notifications                              │
│                                                                │
│  Phase A — Dispatch due scheduled notifications                 │
│    Find PENDING where scheduledAt ≤ now (or null, for retries) │
│    → sendNotification(id) for each                              │
│                                                                │
│  Phase B — Overdue task checks                                  │
│    Scan LIVE events for tasks past scheduledEnd                │
│    → createNotification() + sendNotification() immediately      │
│    Idempotent via 5-min time buckets                            │
│                                                                │
│  Phase C — All-complete event checks                            │
│    Scan LIVE events where all tasks done                       │
│    → createNotification() + sendNotification() immediately      │
│    Idempotent via 5-min time buckets                            │
│                                                                │
│  Triggers: TASK_OVERDUE, EVENT_ALL_COMPLETE                     │
│  Also handles: EVENT_REMINDER_24H/2H (pre-created, scheduled)  │
│  Also handles: retry of any failed action-based notifications   │
└────────────────────────────────────────────────────────────────┘

┌── SCHEDULED REMINDERS (pre-created at event schedule time) ────┐
│                                                                │
│  createEventReminders() called when:                            │
│    - Event transitions DRAFT → SCHEDULED                        │
│    - Event date changes while SCHEDULED                         │
│                                                                │
│  Creates PENDING rows with scheduledAt = eventDate - 24h / 2h   │
│  Old reminders are deleted before new ones are created.         │
│  Reminders in the past are skipped (only future ones created).  │
│  The unified cron dispatches them when scheduledAt ≤ now.      │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **One cron, three phases**: A single `send-notifications` endpoint runs every 1 minute. It dispatches due scheduled notifications, scans for overdue tasks, and checks for all-complete events — all in one pass.
- **Action-based = immediate**: Notifications triggered by user actions (task started, vendor accepted, etc.) dispatch immediately via fire-and-forget from the API route. No waiting for cron.
- **PENDING row as safety net**: Every notification is persisted as a `Notification` row first. If fire-and-forget dispatch fails, the row stays PENDING and the cron retries within 60 seconds. This is the outbox pattern.
- **Pre-created reminders**: When an event is scheduled, `createEventReminders()` pre-creates `Notification` rows with `scheduledAt = eventDate - 24h / 2h`. The cron handles dispatch when due.
- **Idempotency via keys**: Format `<type>:<eventId>:<entityId>:<bucket>`. Per-recipient discriminators (`:coordinator-{cid}`) prevent key collisions across multiple recipients. Time buckets (1-min or 5-min) prevent duplicate notifications from rapid re-triggers.

---

## Notification Types — At-a-Glance Table

| # | Type | Trigger | Timing | Channel(s) | Recipients | Idempotency Key Pattern |
|---|------|---------|--------|------------|------------|-------------------------|
| 1 | `TASK_STARTED` | Task status → `IN_PROGRESS` (API) | Immediate (fire-and-forget) | PUSH | All coordinators | `TASK_STARTED:{eventId}:{taskId}:coordinator-{cid}` |
| 2 | `TASK_COMPLETED` | Task status → `COMPLETED` (API) | Immediate (fire-and-forget) | PUSH | Parent assignee + all coordinators | `TASK_COMPLETED:{eventId}:{taskId}:parent` / `:coordinator-{cid}` |
| 3 | `TASK_UNBLOCKED` | Parent task completed (API) | Immediate (fire-and-forget) | PUSH | Each child task assignee | `TASK_UNBLOCKED:{eventId}:{childId}` |
| 4 | `TASK_DELAYED` | Task delay set (API) | Immediate (fire-and-forget) | PUSH (children + coords), SMS (coords) | Child assignees + all coordinators | `TASK_DELAYED:{eventId}:{childId}:{1min-bucket}` / `:coordinator-{cid}:{1min-bucket}` / `:coordinator-sms-{cid}:{1min-bucket}` |
| 5 | `VENDOR_ACCEPTED` | Vendor accepts invite (API) | Immediate (fire-and-forget) | PUSH | All coordinators | `VENDOR_ACCEPTED:{eventId}:{eventVendorId}:coordinator-{userId}` |
| 6 | `TASK_OVERDUE` | Cron (Phase B): LIVE task past `scheduledEnd` | ≤1 min via cron | PUSH + SMS | Task assignee + all coordinators | `TASK_OVERDUE:{eventId}:{taskId}:{5min-bucket}` / `:sms-{taskId}:{5min-bucket}` / `:coordinator-{cid}-{taskId}:{5min-bucket}` / `:coordinator-sms-{cid}-{taskId}:{5min-bucket}` |
| 7 | `EVENT_ALL_COMPLETE` | Cron (Phase C): all tasks `COMPLETED`/`SKIPPED` | ≤1 min via cron | PUSH | All coordinators | `EVENT_ALL_COMPLETE:{eventId}:{cid}:{5min-bucket}` |
| 8 | `EVENT_REMINDER_24H` | Event → `SCHEDULED` or date change (API pre-creates, cron dispatches) | At `eventDate - 24h` | PUSH + SMS | All coordinators | `EVENT_REMINDER_24H:{eventId}:{userId}` / `:sms-{userId}` |
| 9 | `EVENT_REMINDER_2H` | Event → `SCHEDULED` or date change (API pre-creates, cron dispatches) | At `eventDate - 2h` | PUSH + SMS | All coordinators | `EVENT_REMINDER_2H:{eventId}:{userId}` / `:sms-{userId}` |

### Recipient Role Summary

| Recipient Role | Receives |
|---------------|----------|
| **Owner** | ALL types (always enabled, no opt-out mechanism) |
| **COORDINATOR** (ACCEPTED, linked `userId`) | ALL types (can toggle PUSH/SMS per event via `EventVendor.pushEnabled`/`smsEnabled`) |
| **VENDOR** (ACCEPTED, linked `userId`) | Only `TASK_OVERDUE` (if assigned), `TASK_UNBLOCKED` (if child assignee), `TASK_DELAYED` (if child assignee) — task-specific only. Can toggle PUSH/SMS per event. |

### Unused Enum Values

These `NotificationType` values exist in the Prisma schema but have no implementation yet:

| Enum Value | Status |
|------------|--------|
| `TASK_REMINDER` | Forward-looking stub |
| `EVENT_STARTED` | Forward-looking stub |
| `CUSTOM` | Forward-looking stub |
| `VENDOR_DECLINED` | Forward-looking stub |

### Channel Coverage Matrix

| Notification Type | PUSH | SMS | EMAIL |
|---|---|---|---|
| `TASK_STARTED` | ✅ | — | — |
| `TASK_COMPLETED` | ✅ | — | — |
| `TASK_UNBLOCKED` | ✅ | — | — |
| `TASK_DELAYED` | ✅ | ✅ (coordinators) | — |
| `VENDOR_ACCEPTED` | ✅ | — | — |
| `TASK_OVERDUE` | ✅ | ✅ | — |
| `EVENT_ALL_COMPLETE` | ✅ | — | — |
| `EVENT_REMINDER_24H` | ✅ | ✅ | — |
| `EVENT_REMINDER_2H` | ✅ | ✅ | — |

> **Note:** EMAIL channel infrastructure exists (`sendEmail()` via Resend) but is not used for any `Notification`-table-backed notification type. Vendor invite emails use Resend directly and bypass the Notification table.

---

## Safety Gates

All notifications pass through `createNotification()` in `src/lib/notifications/helpers.ts`, which enforces these gates **in order**:

| # | Gate | Where | Rule |
|---|------|-------|------|
| 1 | **Event state** | `createNotification()` | Skip if event is `DRAFT` or `ARCHIVED` |
| 2 | **Push preference** | `createNotification()` | Skip if `EventVendor.pushEnabled === false` AND channel is `PUSH` |
| 3 | **SMS preference** | `createNotification()` | Skip if `EventVendor.smsEnabled === false` AND channel is `SMS` |
| 4 | **No EventVendor row** | `createNotification()` | Default to **enabled** (owners don't have a row) |
| 5 | **Null preference** | `createNotification()` | Default to **enabled** (opt-out pattern — `null` = allow) |
| 6 | **Idempotency** | `createNotification()` upsert | Duplicate `idempotencyKey` → no-op (prevents double-creation) |
| 7 | **Already dispatched** | `sendNotification()` guard | If status is `SENT` or `SKIPPED` → return early (idempotent dispatch) |

### Preference Storage

| User Type | Preference Location | API |
|-----------|-------------------|-----|
| Owner | Auto-created `EventVendor` row on first preference save (`role = COORDINATOR`) | `PATCH /api/events/[eventId]/notification-prefs` |
| Coordinator / Vendor | Existing `EventVendor` row (`pushEnabled`, `smsEnabled` fields) | `PATCH /api/events/[eventId]/notification-prefs` |

### Notification Event State Rules

| Event State | Notifications |
|-------------|---------------|
| DRAFT | ❌ None (blocked by global gate) |
| SCHEDULED | `VENDOR_ACCEPTED`, `EVENT_REMINDER_24H`/`2H` (pre-created) |
| LIVE | `TASK_STARTED`, `TASK_COMPLETED`, `TASK_UNBLOCKED`, `TASK_DELAYED`, `TASK_OVERDUE`, `EVENT_ALL_COMPLETE` |
| COMPLETED | None (tasks done) |
| ARCHIVED | ❌ None (blocked by global gate) |

---

## Dispatch Flow Detail

```
createNotification(params) → string | null
  │
  ├─ Gate: Event DRAFT/ARCHIVED? → return null
  ├─ Gate: Channel disabled for user? → return null
  ├─ Upsert by idempotencyKey → Notification row (status=PENDING)
  └─ Return notification.id

sendNotification(notificationId) → "SENT" | "SKIPPED"
  │
  ├─ Guard: Already SENT/SKIPPED? → return status
  ├─ Switch on channel:
  │   ├─ PUSH → sendPush(userId, payload)
  │   │   └─ 0 subscriptions → SKIPPED
  │   │   └─ All failed → throw (caught, marked FAILED)
  │   │   └─ Some sent → SENT (partial success tolerated)
  │   ├─ SMS → resolve user.phone → sendSms(phone, body)
  │   │   └─ No phone → SKIPPED
  │   └─ EMAIL → resolve user.email → sendEmail(email, subject, html)
  │       └─ No email → SKIPPED
  └─ Update row: status=SENT, sentAt=now (or status=FAILED)
```

---

## Cron Setup

### Single Cron Job (cron-job.org, free tier)

After deploy, create **one** cron job:

| Setting | Value |
|---------|-------|
| URL | `https://<your-domain>/api/cron/send-notifications` |
| Method | `GET` |
| Interval | Every 1 minute |
| Header | `Authorization: Bearer <CRON_SECRET>` |

The old `check-overdue` endpoint has been removed — all overdue and all-complete logic is now part of the unified `send-notifications` cron.

---

## Implementation Phases (Historical Record)

### Phase 0 — PWA Foundation ✅

| Step | File                                | Action                                                             |
| ---- | ----------------------------------- | ------------------------------------------------------------------ |
| 0.1  | —                                   | Install `@serwist/next`, `serwist`, `@khmyznikov/pwa-install`      |
| 0.2  | `next.config.ts`                    | Wrap with `withSerwist()`, update CSP, `--webpack` flag            |
| 0.3  | `src/app/sw.ts`                     | Create service worker (Serwist + push/click handlers)              |
| 0.4  | `src/app/manifest.ts`               | Create web app manifest route                                      |
| 0.5  | `src/app/layout.tsx`                | Add PWA metadata, `<PwaInstall>`                                   |
| 0.6  | `src/components/ui/pwa-install.tsx` | Install prompt web component wrapper                               |
| 0.7  | `tsconfig.json`                     | Add Serwist types, webworker lib                                   |
| 0.8  | `.gitignore`                        | Add service worker outputs                                         |
| 0.9  | `src/app/~offline/page.tsx`         | Offline fallback page                                              |
| 0.10 | `package.json`                      | Add `--webpack` to dev/build scripts (Next.js 16 Turbopack compat) |

### Phase 1 — Web Push Plumbing ✅

| Step | File                                          | Action                                            |
| ---- | --------------------------------------------- | ------------------------------------------------- |
| 1.1  | —                                             | Install `@pushforge/builder`, generate VAPID keys |
| 1.2  | `prisma/schema.prisma`                        | Add `PushSubscription` model, migrate             |
| 1.3  | `src/app/api/user/push-subscription/route.ts` | POST/DELETE subscription CRUD                     |
| 1.4  | `src/lib/notifications/push.ts`               | `sendPush(userId, payload)` dispatch              |
| 1.5  | `src/app/sw.ts`                               | Wire push + notificationclick handlers            |

- `sendPush()` fans out to ALL subscriptions for a user (multi-device). Expired subs (HTTP 410) auto-deleted.

### Phase 2 — SMS Plumbing ✅

| Step | File                                 | Action                               |
| ---- | ------------------------------------ | ------------------------------------ |
| 2.1  | `.env`                               | Add Twilio env vars                  |
| 2.2  | `src/lib/notifications/sms.ts`       | `sendSms(to, body)` wrapper          |
| 2.3  | `src/app/api/cron/test-sms/route.ts` | CRON_SECRET protected debug endpoint |

- Lazy-singleton Twilio client. Validates E.164 format (`+1XXXXXXXXXX`).

### Phase 3 — Unified Dispatch Pipeline ✅

| Step | File                                           | Action                                              |
| ---- | ---------------------------------------------- | --------------------------------------------------- |
| 3.1  | `src/lib/notifications/email.ts`               | `sendEmail(to, subject, html)` via Resend           |
| 3.2  | `src/app/api/cron/send-notifications/route.ts` | Unified cron (dispatches PENDING, checks overdue)   |
| 3.3  | —                                              | External cron trigger via cron-job.org (free tier)  |

- All three channels (PUSH, SMS, EMAIL) wired in `sendNotification()`.

### Phase 4 — Notification Types ✅

| Step | File                                                                  | Action                                                                             |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 4a   | `src/app/api/invite/[token]/route.ts`                                 | Vendor accepted → VENDOR_ACCEPTED PUSH to all coordinators                         |
| 4b   | `src/app/api/events/[eventId]/tasks/[taskId]/delay/route.ts`          | Task delayed → TASK_DELAYED PUSH+SMS to child assignees + coordinators             |
| 4c   | `src/app/api/events/[eventId]/tasks/[taskId]/status/route.ts`         | Task started → TASK_STARTED; completed → TASK_COMPLETED + TASK_UNBLOCKED           |
| 4d   | `src/app/api/events/[eventId]/status/route.ts` + `[eventId]/route.ts` | Event scheduled → pre-create EVENT_REMINDER_24H/2H; date change → recreate         |
| 4e   | `prisma/schema.prisma`                                                | Extend `NotificationType` enum (13 values)                                         |

- All creation goes through `createNotification()` — idempotent via `idempotencyKey`.
- `resolveCoordinatorUserIds()` = event owner + all accepted COORDINATOR-role EventVendors.

### Phase 5 — Cron-Polled + Frontend UI ✅

| Step | File                                             | Action                                                        |
| ---- | ------------------------------------------------ | ------------------------------------------------------------- |
| 5a   | `src/app/api/cron/check-overdue/route.ts`        | ~~Overdue task checker cron~~ *(removed 2026-07-07 — merged into send-notifications)* |
| 5b   | `src/lib/notifications/usePushSubscription.ts`   | Push opt-in hook                                              |
| 5c   | `src/components/ui/notification-toast.tsx`       | In-app toast via Supabase Realtime + custom ToastProvider     |
| 5d   | `src/components/event/notification-settings.tsx` | Notification preferences UI (PUSH + SMS toggles)              |

- Custom toast system: `ToastProvider` + `useToast()` hook. `NotificationToastListener` subscribes to Supabase Realtime.

### Phase 6 — Immediate Dispatch & Cron Consolidation ✅ (2026-07-07)

| Step | File | Action |
| ---- | ---- | ------ |
| 6a   | `src/lib/notifications/helpers.ts` | `createNotification()` now returns `string \| null` (notification ID) |
| 6b   | `src/app/api/events/[eventId]/tasks/[taskId]/status/route.ts` | Fixed `TASK_STARTED` idempotency key bug. All notifications → fire-and-forget `sendNotification()`. |
| 6c   | `src/app/api/events/[eventId]/tasks/[taskId]/delay/route.ts` | `TASK_DELAYED` → fire-and-forget dispatch |
| 6d   | `src/app/api/invite/[token]/route.ts` | Fixed `VENDOR_ACCEPTED` idempotency key bug. Fire-and-forget dispatch. |
| 6e   | `src/app/api/cron/send-notifications/route.ts` | Merged `check-overdue` logic into unified 3-phase cron. Creates + dispatches immediately. |
| 6f   | `src/app/api/cron/check-overdue/route.ts` | **Deleted** — logic merged into `send-notifications` |

**Bugs fixed:**
- `TASK_STARTED`: idempotency key was shared across all coordinators → only the first received notifications. Now uses per-coordinator discriminator (`:coordinator-{cid}`).
- `VENDOR_ACCEPTED`: same bug — idempotency key shared across all coordinators. Fixed with `:coordinator-{userId}` discriminator.

**Architecture changes:**
- Action-based notifications dispatch immediately (fire-and-forget) instead of waiting for cron.
- Single unified cron (every 1 min) replaces two crons. Overdue notifications now arrive within ≤1 min instead of up to 6 min.

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  @@index([userId])
}
```

Reverse relation added to `User` model: `pushSubscriptions PushSubscription[]`

### NotificationType Enum Extension (Phase 4e)

```
TASK_REMINDER (existing) → TASK_OVERDUE, TASK_COMPLETED, TASK_UNBLOCKED, TASK_STARTED
TASK_DELAYED (existing) → keep
EVENT_STARTED (existing) → keep, add EVENT_REMINDER_24H, EVENT_REMINDER_2H, EVENT_ALL_COMPLETE
CUSTOM (existing) → keep, add VENDOR_ACCEPTED, VENDOR_DECLINED
```

### User Notification Prefs (Phase 5d) ✅ Implemented — Per-Event

```prisma
// On EventVendor model (per-user, per-event):
pushEnabled   Boolean?   // null = enabled (opt-out pattern)
smsEnabled    Boolean?   // null = enabled (opt-out pattern)
```

Preferences are stored on `EventVendor` — each user has independent prefs for each event. The event owner (who has no EventVendor row) defaults to enabled for all channels.

- **Notification bell** (`src/components/event/notification-bell.tsx`) in timeline header shows recent notifications + PUSH/SMS toggles
- **API**: `PATCH /api/events/[eventId]/notification-prefs` updates per-event prefs
- **API**: `GET /api/events/[eventId]/notifications` returns recent sent notifications for the bell dropdown

---

## Packages

| Package                   | License | Usage                            | Phase |
| ------------------------- | ------- | -------------------------------- | ----- |
| `@serwist/next`           | MIT     | PWA service worker + precaching  | 0     |
| `serwist`                 | MIT     | Service worker runtime (dev dep) | 0     |
| `@khmyznikov/pwa-install` | MIT     | Cross-browser install prompt     | 0     |
| `@pushforge/builder`      | MIT     | Web Push server dispatch         | 1     |
| `twilio`                  | MIT     | SMS dispatch (already installed) | 2     |
| `sonner` (shadcn toast)   | MIT     | In-app toast notifications       | 5c    |

---

## Verification Checklist

- [ ] Phase 0: Lighthouse PWA = 100, install prompt on Chrome + iOS Safari
- [ ] Phase 1: Push notification received with browser tab closed
- [ ] Phase 2: SMS received on phone
- [ ] Phase 3: Notification inserted → dispatched within 1 minute
- [ ] Phase 4: Vendor accepted → push received. Event live → broadcast received
- [ ] Phase 5: Task overdue → notified within 5 min. Preferences toggles work
- [x] `npm run build` passes after Phase 5
- [ ] Existing email notifications (Resend) unaffected

## Env Vars Added (Phase 1)

| Variable                       | Client? | Description                                           |
| ------------------------------ | ------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes     | VAPID public key (base64url) for browser Push API     |
| `VAPID_PRIVATE_KEY`            | No      | VAPID private key (JWK JSON) for server-side dispatch |

Generate with: `npx @pushforge/builder vapid`
