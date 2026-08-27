/*
  Warnings:

  - The `events` column on the `webhooks` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "webhooks" DROP COLUMN "events",
ADD COLUMN     "events" "EventType"[];
