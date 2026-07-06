/*
  Warnings:

  - You are about to drop the column `pushEnabled` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `smsEnabled` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EventVendor" ADD COLUMN     "pushEnabled" BOOLEAN,
ADD COLUMN     "smsEnabled" BOOLEAN;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "pushEnabled",
DROP COLUMN "smsEnabled";
