# Day Coordinator — Copilot Context

## Product Vision
Full product vision, data model, phase strategy, and UX principles are documented in `docs/VISION.md`.
Read it before making architectural decisions or adding new models/screens.

## System Overview
Day Coordinator is a day-of coordination and scheduling platform for weddings and events.
It provides real-time task management, timeline visualization, vendor coordination,
and live-mode tracking during an event.

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

| Action              | Event Name          |
|---------------------|---------------------|
| Task created        | `task.created`      |
| Task updated        | `task.updated`      |
| Task started        | `task.started`      |
| Task completed      | `task.completed`    |
| Task delayed        | `task.delayed`      |

Channel naming: `event-{eventId}`

## Notification System Rules
- All sends must be **idempotent** — check `NotificationStatus` before sending.
- Use `sendNotification(id)` from `src/lib/notifications/index.ts` — never dispatch directly from API routes.
- Never send a notification without checking `NotificationStatus` first.

## Database Rules
- **Never remove fields** from existing models — only extend with nullable columns.
- **Prefer nullable columns** over restructuring existing tables.
- Use `ActivityLog` for all audit trail, history, and rollback analysis.
- Every schema migration must have a corresponding `ActivityLog` action string defined.

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
