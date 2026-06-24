-- CreateIndex
CREATE INDEX "ActivityLog_eventId_idx" ON "ActivityLog"("eventId");

-- CreateIndex
CREATE INDEX "ActivityLog_taskId_idx" ON "ActivityLog"("taskId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE INDEX "EventVendor_eventId_idx" ON "EventVendor"("eventId");

-- CreateIndex
CREATE INDEX "EventVendor_userId_idx" ON "EventVendor"("userId");

-- CreateIndex
CREATE INDEX "EventVendor_vendorContactId_idx" ON "EventVendor"("vendorContactId");

-- CreateIndex
CREATE INDEX "EventVendor_status_idx" ON "EventVendor"("status");

-- CreateIndex
CREATE INDEX "EventVendor_role_idx" ON "EventVendor"("role");

-- CreateIndex
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "SubTask_taskId_idx" ON "SubTask"("taskId");

-- CreateIndex
CREATE INDEX "SubTask_completedById_idx" ON "SubTask"("completedById");

-- CreateIndex
CREATE INDEX "SubTaskVendor_eventVendorId_idx" ON "SubTaskVendor"("eventVendorId");

-- CreateIndex
CREATE INDEX "Task_eventId_idx" ON "Task"("eventId");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "TaskVendor_eventVendorId_idx" ON "TaskVendor"("eventVendorId");

-- CreateIndex
CREATE INDEX "Venue_creatorId_idx" ON "Venue"("creatorId");
