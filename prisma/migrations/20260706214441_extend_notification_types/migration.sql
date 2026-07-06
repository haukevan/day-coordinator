-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_UNBLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER_24H';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER_2H';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_ALL_COMPLETE';
ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_DECLINED';
