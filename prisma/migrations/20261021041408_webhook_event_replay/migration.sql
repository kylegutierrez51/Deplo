-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_REPLAYED';

-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "webhookId" TEXT;

-- CreateIndex
CREATE INDEX "webhook_events_webhookId_idx" ON "webhook_events"("webhookId");

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
