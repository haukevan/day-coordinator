-- CreateTable
CREATE TABLE "TaskVendor" (
    "taskId" TEXT NOT NULL,
    "eventVendorId" TEXT NOT NULL,

    CONSTRAINT "TaskVendor_pkey" PRIMARY KEY ("taskId", "eventVendorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskVendor_taskId_eventVendorId_key" ON "TaskVendor"("taskId", "eventVendorId");

-- AddForeignKey
ALTER TABLE "TaskVendor" ADD CONSTRAINT "TaskVendor_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskVendor" ADD CONSTRAINT "TaskVendor_eventVendorId_fkey" FOREIGN KEY ("eventVendorId") REFERENCES "EventVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
