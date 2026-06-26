/*
  Warnings:

  - You are about to drop the column `registedAgo` on the `webhooks` table. All the data in the column will be lost.
  - Changed the type of `resourceType` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `registeredAgo` to the `webhooks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PIPELINE', 'PIPELINE_RUN', 'APPROVAL', 'SECRET', 'WEBHOOK', 'STAGE_RESULT', 'SETTING');

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "resourceType",
ADD COLUMN     "resourceType" "ResourceType" NOT NULL;

-- AlterTable
ALTER TABLE "webhooks" DROP COLUMN "registedAgo",
ADD COLUMN     "registeredAgo" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");
