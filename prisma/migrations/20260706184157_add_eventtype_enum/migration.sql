/*
  Warnings:

  - Changed the type of `eventType` on the `webhook_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PUSH', 'PULL_REQUEST');

-- AlterTable
ALTER TABLE "webhook_events" DROP COLUMN "eventType",
ADD COLUMN     "eventType" "EventType" NOT NULL;
