-- AlterTable
ALTER TABLE "EventVendor" ADD COLUMN     "invitedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "EventVendor_invitedByUserId_idx" ON "EventVendor"("invitedByUserId");

-- AddForeignKey
ALTER TABLE "EventVendor" ADD CONSTRAINT "EventVendor_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
