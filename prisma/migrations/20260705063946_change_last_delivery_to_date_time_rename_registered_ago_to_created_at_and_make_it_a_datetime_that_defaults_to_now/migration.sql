/*
  Warnings:

  - You are about to drop the column `registeredAgo` on the `webhooks` table. All the data in the column will be lost.
  - The `lastDelivery` column on the `webhooks` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "webhooks" DROP COLUMN "registeredAgo",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "lastDelivery",
ADD COLUMN     "lastDelivery" TIMESTAMP(3);
