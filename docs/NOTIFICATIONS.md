# Notification System — Architecture & Implementation Plan

> **Status:** Phase 0–5 ✅ All phases complete  
> **Last updated:** 2026-07-06

---

## Overview

Multi-channel notification system for Day Coordinator: PWA installability, Web Push for background delivery, SMS via Twilio, and cron-based scheduling on Vercel Pro. All packages are MIT-licensed — no paid tiers, no upgrade traps.

### Channels

| Channel          | Use Case                                | Delivery Mechanism                                                                 |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| **In-App (PWA)** | App is open                             | Supabase Realtime Broadcast → toast                                                |
| **Web Push**     | App closed or backgrounded              | `@pushforge/builder` → browser push service → service worker → system notification |
| **SMS**          | Anytime, phone not required to have app | Twilio REST API → cellular network                                                 |

### Architecture

```
Action (API route) ──→ Create Notification (status=PENDING)
                              │
Cron scan (overdue) ──→ Create Notification (status=PENDING)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     Dispatch Cron (every 1 min)      scheduledAt > now?
              │                         (wait for dispatch)
              ▼
     sendNotification(id)
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  PUSH       SMS      EMAIL
(@pushforge) (Twilio) (Resend—existing)
```

### Key Design Decisions

- **Two crons total**: `send-notifications` (every 1 min — dispatches all PENDING) + `check-overdue` (every 5 min — creates overdue notifications). All notification types flow through these two pipes.
- **Action-based where possible**: Notifications tied to user actions fire immediately from API routes. Only overdue tasks and pre-scheduled reminders need cron.
- **Pre-created reminders**: When an event is scheduled, we create `Notification` rows with `scheduledAt = eventDate - 24h`. The dispatch cron handles the rest — no separate reminder cron needed.
- **Idempotency via keys**: `<type>:<eventId>:<entityId>:<time-bucket>` prevents duplicates from cron re-scans.

---

## Notification Types

| #   | Type                 | Trigger                                | Channel    | Recipients                          |
| --- | -------------------- | -------------------------------------- | ---------- | ----------------------------------- |
| 1   | `EVENT_REMINDER_24H` | Action: event scheduled                | PUSH + SMS | All coordinators                    |
| 2   | `EVENT_REMINDER_2H`  | Action: event scheduled                | PUSH + SMS | All coordinators                    |
| 3   | `VENDOR_ACCEPTED`    | Action: invite accepted                | PUSH       | All coordinators                    |
| 4   | `VENDOR_DECLINED`    | Action: invite declined (future)       | PUSH       | All coordinators                    |
| 5   | `TASK_DELAYED`       | Action: task delay set                 | PUSH + SMS | Downstream assignees + coordinators |
| 6   | `TASK_COMPLETED`     | Action: task completed                 | PUSH       | Parent assignee + coordinators      |
| 7   | `TASK_UNBLOCKED`     | Action: parent completed               | PUSH       | Child task assignee                 |
| 8   | `TASK_STARTED`       | Action: task → IN_PROGRESS             | PUSH       | Coordinators                        |
| 9   | `EVENT_STARTED`      | Action: first task started / auto-cron | PUSH + SMS | All event members                   |
| 10  | `TASK_OVERDUE`       | Cron: every 5 min, LIVE events         | PUSH + SMS | Task assignee + coordinators        |
| 11  | `EVENT_ALL_COMPLETE` | Cron: every 5 min                      | PUSH       | All coordinators                    |

---

## Phases

### Phase 0 — PWA Foundation ✅ COMPLETE

**Test:** Lighthouse PWA = 100. Install prompt on Chrome + iOS Safari.

| Step | File                                | Action                                                             | Done |
| ---- | ----------------------------------- | ------------------------------------------------------------------ | ---- |
| 0.1  | —                                   | Install `@serwist/next`, `serwist`, `@khmyznikov/pwa-install`      | ✅   |
| 0.2  | `next.config.ts`                    | Wrap with `withSerwist()`, update CSP, `--webpack` flag            | ✅   |
| 0.3  | `src/app/sw.ts`                     | Create service worker (Serwist + push/click handlers)              | ✅   |
| 0.4  | `src/app/manifest.ts`               | Create web app manifest route                                      | ✅   |
| 0.5  | `src/app/layout.tsx`                | Add PWA metadata, `<PwaInstall>`                                   | ✅   |
| 0.6  | `src/components/ui/pwa-install.tsx` | Install prompt web component wrapper                               | ✅   |
| 0.7  | `tsconfig.json`                     | Add Serwist types, webworker lib                                   | ✅   |
| 0.8  | `.gitignore`                        | Add service worker outputs                                         | ✅   |
| 0.9  | `src/app/~offline/page.tsx`         | Offline fallback page                                              | ✅   |
| 0.10 | `package.json`                      | Add `--webpack` to dev/build scripts (Next.js 16 Turbopack compat) | ✅   |
| 0.11 | —                                   | `npm run build` passes                                             | ✅   |

### Phase 1 — Web Push Plumbing ✅ COMPLETE

**Test:** Browser subscribes → DB stores subscription → server sends → system notification appears.

| Step | File                                          | Action                                            | Done |
| ---- | --------------------------------------------- | ------------------------------------------------- | ---- |
| 1.1  | —                                             | Install `@pushforge/builder`, generate VAPID keys | ✅   |
| 1.2  | `prisma/schema.prisma`                        | Add `PushSubscription` model, migrate             | ✅   |
| 1.3  | `src/app/api/user/push-subscription/route.ts` | POST/DELETE subscription CRUD                     | ✅   |
| 1.4  | `src/lib/notifications/push.ts`               | `sendPush(userId, payload)` dispatch              | ✅   |
| 1.5  | `src/app/sw.ts`                               | Wire push + notificationclick handlers            | ✅   |

**Implementation notes:**

- `PushSubscription` model uses `onDelete: Cascade` so subscriptions are cleaned up when a user is deleted
- `sendPush()` fans out to ALL subscriptions for a user (multiple devices supported)
- Expired subscriptions (HTTP 410 from push service) are auto-deleted from the DB
- `usePushSubscription()` hook created in `src/lib/notifications/usePushSubscription.ts` (originally Phase 5b, moved up for E2E testing)
- PUSH channel fully wired in `sendNotification()` — calls `sendPush()` for PUSH type
- No changes needed to `src/app/sw.ts` — push/notificationclick handlers were already in place from Phase 0

### Phase 2 — SMS Plumbing ✅ COMPLETE

**Test:** Call endpoint → SMS arrives at phone.

| Step | File                                 | Action                               | Done |
| ---- | ------------------------------------ | ------------------------------------ | ---- |
| 2.1  | `.env`                               | Add Twilio env vars                  | ✅   |
| 2.2  | `src/lib/notifications/sms.ts`       | `sendSms(to, body)` wrapper          | ✅   |
| 2.3  | `src/app/api/cron/test-sms/route.ts` | CRON_SECRET protected debug endpoint | ✅   |

**Implementation notes:**

- `sendSms()` uses lazy-singleton Twilio client (same pattern as `src/lib/resend.ts`)
- Validates E.164 phone format (`+1XXXXXXXXXX`) before sending
- SMS channel fully wired in `sendNotification()` — calls `sendSms()` for SMS type
- Test endpoint at `POST /api/cron/test-sms` — requires `Authorization: Bearer <CRON_SECRET>`, accepts `{ to, body }`
- No rate limiting at this phase — will be added with notification preferences in Phase 5

### Phase 3 — Unified Dispatch Pipeline ✅ COMPLETE

**Test:** Insert Notification → ≤1 min → dispatched via correct channel.

| Step | File                                           | Action                                                              | Done |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------- | ---- |
| 3.1  | `src/lib/notifications/email.ts`               | `sendEmail(to, subject, html)` via Resend                           | ✅   |
| 3.2  | `src/app/api/cron/send-notifications/route.ts` | Unified dispatch cron (finds all PENDING, calls `sendNotification`) | ✅   |
| 3.3  | —                                              | External cron trigger via cron-job.org (free tier)                  | ✅   |

**Implementation notes:**

- All three channels (PUSH, SMS, EMAIL) wired in `sendNotification()`
- `sendEmail()` wraps the existing Resend client from `src/lib/resend.ts`
- Dispatch cron at `GET /api/cron/send-notifications` (CRON_SECRET protected)
- Uses cron-job.org (free) instead of Vercel cron (requires Pro) — setup instructions in Phase 5 summary

### Phase 4 — First Notification Types ✅ COMPLETE

**Test:** Vendor accepts → coordinator gets push. Task delayed → downstream notified. Event scheduled → reminders created.

| Step | File                                                                  | Action                                                                             | Done |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- |
| 4a   | `src/app/api/invite/[token]/route.ts`                                 | Vendor accepted → VENDOR_ACCEPTED PUSH to all coordinators                         | ✅   |
| 4b   | `src/app/api/events/[eventId]/tasks/[taskId]/delay/route.ts`          | Task delayed → TASK_DELAYED PUSH to child assignees + coordinators                 | ✅   |
| 4c   | `src/app/api/events/[eventId]/tasks/[taskId]/status/route.ts`         | Task started → TASK_STARTED PUSH; completed → TASK_COMPLETED + TASK_UNBLOCKED PUSH | ✅   |
| 4d   | `src/app/api/events/[eventId]/status/route.ts` + `[eventId]/route.ts` | Event scheduled → pre-create EVENT_REMINDER_24H/2H; date change → recreate         | ✅   |
| 4e   | `prisma/schema.prisma`                                                | Extend `NotificationType` enum (13 values — all future types included)             | ✅   |

**Implementation notes:**

- All notification creation goes through `createNotification()` in `src/lib/notifications/helpers.ts` — idempotent via `idempotencyKey`
- `resolveCoordinatorUserIds()` returns event owner + all accepted COORDINATOR-role EventVendors
- Notifications are created as PENDING — the Phase 3 dispatch cron sends them within 1 minute
- Event reminders auto-delete old ones before recreating (safe for date changes)
- Reminders in the past are skipped (only future reminders are created)

### Phase 5 — Cron-Polled + Frontend UI ✅ COMPLETE

**Test:** Task overdue → within 5 min → assignee notified. User toggles preferences.

| Step | File                                             | Action                                                        | Done |
| ---- | ------------------------------------------------ | ------------------------------------------------------------- | ---- |
| 5a   | `src/app/api/cron/check-overdue/route.ts`        | Overdue task checker cron (TASK_OVERDUE + EVENT_ALL_COMPLETE) | ✅   |
| 5b   | `src/lib/notifications/usePushSubscription.ts`   | Push opt-in hook ✅ (built in Phase 1)                        | ✅   |
| 5c   | `src/components/ui/notification-toast.tsx`       | In-app toast via Supabase Realtime + custom ToastProvider     | ✅   |
| 5d   | `src/components/event/notification-settings.tsx` | Notification preferences UI (PUSH + SMS toggles)              | ✅   |

**Implementation notes:**

- `check-overdue` cron scans LIVE events for tasks past their `scheduledEnd` — creates TASK_OVERDUE PUSH+SMS
- Also detects when all tasks are COMPLETED/SKIPPED → EVENT_ALL_COMPLETE PUSH
- Uses 5-minute idempotency buckets to prevent duplicate notifications
- Toast system built from scratch (no external dependency) — `ToastProvider` + `useToast()` hook
- `NotificationToastListener` subscribes to Supabase Realtime broadcasts for task events
- Settings UI uses shadcn `Switch` component, saves to `PATCH /api/events/[eventId]/notification-prefs`
- `pushEnabled`/`smsEnabled` on `EventVendor` — per-user, per-event preferences
- **Notification bell** in timeline header shows recent notifications dropdown + PUSH/SMS toggles
- Bell only visible for SCHEDULED and LIVE events
- **Global safety gate**: No notifications for DRAFT or ARCHIVED events
- **VENDOR_ACCEPTED gate**: Only fires for SCHEDULED+ events (global gate blocks DRAFT/ARCHIVED)

### Safety Gates (Phase 5)

| Gate            | Where                  | Rule                                                                                                             |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Event state     | `createNotification()` | Skip if event is DRAFT or ARCHIVED                                                                               |
| User prefs      | `createNotification()` | Check `EventVendor.pushEnabled`/`smsEnabled` per-event-per-user. Owner (no EventVendor row) defaults to enabled. |
| VENDOR_ACCEPTED | Invite route           | Global gate blocks DRAFT/ARCHIVED; fires for SCHEDULED/LIVE/COMPLETED                                            |

### Notification Event State Rules

| Event State | Notifications                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| DRAFT       | ❌ None (blocked by global gate)                                                                            |
| SCHEDULED   | VENDOR_ACCEPTED, EVENT_REMINDER_24H/2H                                                                      |
| LIVE        | TASK_STARTED, TASK_COMPLETED, TASK_UNBLOCKED, TASK_DELAYED, EVENT_STARTED, TASK_OVERDUE, EVENT_ALL_COMPLETE |
| COMPLETED   | None (tasks done)                                                                                           |
| ARCHIVED    | ❌ None (blocked by global gate)                                                                            |

### cron-job.org Setup (after deploy)

1. Create 2 cron jobs at [cron-job.org](https://cron-job.org):
   - `send-notifications` — every 1 min
   - `check-overdue` — every 5 min
2. Both use `GET` method with header `Authorization: Bearer <CRON_SECRET>`

---

## Database Changes

### PushSubscription (Phase 1) ✅ Implemented

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
