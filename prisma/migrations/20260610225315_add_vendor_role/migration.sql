-- CreateEnum
CREATE TYPE "VendorRole" AS ENUM ('VENDOR', 'COORDINATOR');

-- AlterTable
ALTER TABLE "EventVendor" ADD COLUMN     "role" "VendorRole" NOT NULL DEFAULT 'VENDOR';
