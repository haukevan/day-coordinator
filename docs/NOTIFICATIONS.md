# Notification System — Architecture & Implementation Plan

> **Status:** Phase 0 ✅ Complete — Phase 1 ✅ Complete — Phase 2 next  
> **Last updated:** 2026-07-02

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

### Phase 2 — SMS Plumbing

**Test:** Call endpoint → SMS arrives at phone.

| Step | File                           | Action                      |
| ---- | ------------------------------ | --------------------------- |
| 2.1  | `.env`                         | Add Twilio env vars         |
| 2.2  | `src/lib/notifications/sms.ts` | `sendSms(to, body)` wrapper |
| 2.3  | —                              | Test via debug endpoint     |

### Phase 3 — Unified Dispatch Pipeline

**Test:** Insert Notification → ≤1 min → dispatched via correct channel.

| Step | File                                           | Action                                                                        |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| 3.1  | `src/lib/notifications/index.ts`               | Wire SMS → `sendSms()`, EMAIL → `sendEmail()` (PUSH already wired in Phase 1) |
| 3.2  | `src/app/api/cron/send-notifications/route.ts` | Unified dispatch cron                                                         |
| 3.3  | `vercel.json`                                  | Add cron schedule, upgrade Vercel to Pro                                      |

### Phase 4 — First Notification Types

**Test:** Vendor accepts → coordinator gets push. Event goes live → broadcast.

| Step | File                                                          | Action                                        |
| ---- | ------------------------------------------------------------- | --------------------------------------------- |
| 4a   | `src/app/api/invite/[token]/route.ts`                         | Vendor accepted → coordinator alert           |
| 4b   | `src/app/api/events/[eventId]/tasks/[taskId]/delay/route.ts`  | Task delayed → downstream alert               |
| 4c   | `src/app/api/events/[eventId]/tasks/[taskId]/status/route.ts` | Event live → broadcast                        |
| 4d   | `src/app/api/events/[eventId]/status/route.ts`                | Event scheduled → pre-create 24h/2h reminders |
| 4e   | `prisma/schema.prisma`                                        | Extend `NotificationType` enum                |

### Phase 5 — Cron-Polled + Frontend UI

**Test:** Task overdue → within 5 min → assignee notified. User toggles preferences.

| Step | File                                             | Action                                                                     |
| ---- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 5a   | `src/app/api/cron/check-overdue/route.ts`        | Overdue task checker cron                                                  |
| 5b   | `src/lib/notifications/usePushSubscription.ts`   | Push opt-in hook ✅ (already built in Phase 1, wire into settings UI here) |
| 5c   | `src/components/ui/notification-toast.tsx`       | In-app toast via Supabase Realtime                                         |
| 5d   | `src/components/event/notification-settings.tsx` | Notification preferences UI                                                |

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

### User Notification Prefs (Phase 5d)

Nullable columns on User: `pushEnabled`, `smsEnabled`, `taskReminders`, `delayAlerts`

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
- [x] `npm run build` passes after Phase 1
- [ ] Existing email notifications (Resend) unaffected

## Env Vars Added (Phase 1)

| Variable                       | Client? | Description                                           |
| ------------------------------ | ------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes     | VAPID public key (base64url) for browser Push API     |
| `VAPID_PRIVATE_KEY`            | No      | VAPID private key (JWK JSON) for server-side dispatch |

Generate with: `npx @pushforge/builder vapid`
