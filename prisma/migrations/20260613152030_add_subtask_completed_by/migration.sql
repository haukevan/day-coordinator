-- AlterTable
ALTER TABLE "SubTask" ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completedByName" TEXT;

-- AddForeignKey
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
