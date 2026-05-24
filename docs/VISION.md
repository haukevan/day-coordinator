# Realtime Event Coordination Platform (Full Architecture v1)

---

# 1. Product Vision
A mobile-first realtime coordination system for small private events such as weddings, birthdays, anniversaries, and reunions.
The system replaces:
- printed schedules
- spreadsheets
- group messaging chaos
- manual vendor coordination
Core idea:
- a live operational timeline for real-world events

---

# 2. Core Product Goals
- fast event creation
- simple timeline building
- easy vendor invitations
- realtime live event coordination
- mobile-first usage via PWA
- minimal cognitive load during live operations

---

# 3. Technology Stack
Frontend:
- Next.js (App Router)
- TypeScript
- TailwindCSS
- PWA (service worker based offline support)
- Zustand
- TanStack Query

Backend:
- Next.js API routes (Phase 1)
- Prisma ORM

Database:
- PostgreSQL

Realtime:
- Supabase Realtime (current implementation)
- Pusher / Ably (alternative options)

Storage:
- Cloudflare R2

Payments:
- Stripe

Notifications:
- Twilio SMS
- Web Push (PWA)

Jobs:
- BullMQ + Redis or Trigger.dev (Phase 2)

---

# 4. Application Modes
Planning Mode:
- event setup
- task creation
- vendor assignment
- scheduling configuration
- file uploads

Live Mode:
- auto activates at first task start
- optional pre-start trigger (15, 30, 60 minutes)
- realtime coordination dashboard
- live updates and notifications

---

# 5. Roles (Event Scoped)
Owner:
- single per event
- billing control
- full admin permissions

Admin:
- manage event timeline
- create and edit tasks
- manage vendors
- trigger notifications
- control live mode

User (Vendor or participant):
- view timeline
- update task status
- add notes
- check-in
- receive notifications

---

# 6. Event Lifecycle
- Draft
- Scheduled
- Live
- Completed
- Archived

Event start definition:
- first task start time

Event lock:
- event date becomes immutable once live begins

---

# 7. Core Scheduling Model
Task structure:
- start time
- duration
- optional dependency (single only)
- optional offset minutes

Rules:
- only one dependency per task
- dependency optional
- no circular dependencies
- dependency must be within same event

Scheduling rule:
- task start equals dependency end plus offset

---

# 8. Task Timing Fields
Each task includes:
- scheduled start
- scheduled end
- actual start
- actual end

---

# 9. Task States
Schedule states:
- upcoming
- active
- completed
- blocked
- delayed

Operational states:
- on track
- ahead
- behind

---

# 10. Manual Overrides
If admin manually changes:
- start time
- duration
- dependency

Then:
- task becomes manually overridden
- automatic scheduling stops for that task

---

# 11. Dependency Engine
Rules:
- one dependency maximum
- same event only
- no cycles allowed
- completed tasks do not recalculate
- only future tasks are affected by changes

Propagation:
- delay in parent task shifts dependent tasks forward
- notifications triggered automatically on changes

---

# 12. Live Mode System
Activation:
- automatic at first task start
- or pre-triggered before event start

Live Mode includes:
- active task highlighting
- next task preview
- delay indicators
- vendor check-in status
- realtime chat
- admin quick actions

---

# 13. Notification System
Channels:
- SMS (primary)
- PWA push notifications

Types:
- task starting soon
- task delayed
- task completed
- vendor check-in reminders
- event announcements
- schedule updates

Preferences:
- SMS on/off
- push on/off
- task notifications toggle
- delay alerts toggle
- broadcast messages toggle

Safety:
- confirmation required for sensitive event broadcasts

---

# 14. Vendor Check-in System
Flow:
- vendor invited via link
- phone number verification required
- account created or restored
- event access granted
- check-in action ("I'm here")

Optional:
- selfie capture during check-in

---

# 15. Messaging System
Scope:
- event-level group chat only

Features:
- realtime messaging
- attachments allowed
- timestamps
- sender identity

Retention:
- archived 30 days after event ends

---

# 16. Public Timeline (QR View)
Features:
- read-only access
- realtime schedule updates allowed
- mobile optimized

Visible:
- task title
- description
- timing information

Hidden:
- vendors
- internal notes
- operational states
- assignments

---

# 17. Payments
Model:
- per-event payment

Free mode:
- planning allowed only

Paid unlock:
- vendor invitations
- live mode
- notifications
- attachments
- messaging
- QR public timeline sharing

---

# 18. File Upload System
Storage:
- Cloudflare R2

Supported types:
- images
- PDFs
- spreadsheets
- videos

Upload flow:
- client requests signed URL
- uploads directly to storage
- backend stores metadata record

Limits:
- per-event storage quota
- quota increases with payment

---

# 19. Offline PWA Mode
Supports:
- timeline viewing only

Cached data:
- event timeline
- task schedules

Not supported offline:
- messaging
- edits
- uploads
- status updates

---

# 20. Data Model (PostgreSQL)
User:
- id
- email
- phone
- phone verified flag
- name
- avatar

Event:
- id
- owner id
- title
- description
- event date
- timezone
- status
- live mode flag
- public timeline flag
- public slug
- payment status

EventMember:
- id
- event id
- user id
- role
- check-in timestamp
- selfie url
- notification preferences

Task:
- id
- event id
- title
- description
- start time
- end time
- duration
- dependency task id
- status
- operational status
- actual start
- actual end
- manually overridden flag
- public visibility flag

TaskAssignment:
- id
- task id
- user id
- role
- completion status
- readiness status

Subtask:
- id
- task id
- title
- completion status

Attachment:
- id
- event id
- task id (optional)
- file url
- file type
- file size

Message:
- id
- event id
- sender id
- message content
- created timestamp

Notification:
- id
- event id
- task id
- user id
- type
- channel
- scheduled time
- sent time
- status

ActivityLog:
- id
- event id
- actor id
- action type
- entity type
- entity id
- metadata
- timestamp

---

# 21. Realtime Architecture
Provider:
- Supabase Realtime (current)
- Pusher or Ably (alternative)

Channel structure:
- private-event-{eventId}

Events:
- task created
- task updated
- task started
- task completed
- task delayed
- dependency updated
- member joined
- member checked in
- message created
- live mode started
- live mode ended
- schedule recalculated

---

# 22. Scheduling Engine
Responsibilities:
- calculate task timing
- apply dependency rules
- propagate delays
- trigger notifications
- update realtime clients

Rules:
- single dependency only
- no circular dependencies
- same event only
- completed tasks immutable
- manual overrides stop propagation

Propagation:
- only future tasks update
- downstream recalculation automatic

---

# 23. Notification Engine
Pipeline:
- event action triggers job
- job queued
- worker processes job
- SMS or push sent
- delivery status recorded

Queue system:
- BullMQ with Redis (Phase 2)

Providers:
- Twilio SMS
- PWA push notifications

---

# 24. File Upload System
- signed upload URLs used
- direct upload to R2
- metadata stored in database
- per-event storage limits enforced

---

# 25. UI / UX Design Principles
- mobile-first design
- operational simplicity
- low cognitive load
- realtime clarity over detail density

---

# 26. Primary Screens
Event Dashboard:
- list of events
- live indicators
- payment status

Timeline Screen:
- chronological task view
- assignments
- status indicators

Live Mode Screen:
- active task highlight
- next task preview
- delay visibility
- check-in summary

Task Detail Screen:
- full task info
- notes
- attachments
- checklist

Vendor View:
- assigned tasks only
- check-in actions
- simplified UI

Public Timeline:
- read-only schedule
- realtime updates
- minimal data

---

# 27. Mobile UX Patterns
- bottom navigation
- floating action button for admins
- swipe actions on tasks
- color coded statuses:
  - green on track
  - yellow warning
  - red delayed
  - blue active

---

# 28. Event Flows
Event creation flow:
- create event
- define details
- build timeline
- assign tasks
- configure notifications
- activate payment
- invite vendors
- go live

Vendor flow:
- receive invite
- verify phone
- join event
- view timeline
- check in on arrival
- participate in live event

Live event flow:
- live mode activates
- tasks begin
- notifications triggered
- delays propagate
- vendors update status
- event completes

---

# 29. Security Model
Authentication:
- magic link email login
- OTP phone verification

Authorization:
- event-scoped role checks on every request

Public access:
- unguessable event slug URLs
- read-only access only

---

# 30. Scalability Considerations
Main constraints:
- SMS cost scaling
- realtime event concurrency
- media storage growth
- notification job volume during live events

---

# 31. Phase Strategy
Phase 1 (MVP):
- core event system
- tasks and dependencies
- live mode
- realtime updates
- SMS notifications
- vendor check-in
- public timeline
- payments
- file uploads
- group messaging

Phase 2:
- templates
- advanced scheduling tools
- AI suggestions
- analytics
- native apps
- enhanced offline sync
- vendor profiles
- reusable event systems
