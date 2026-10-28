-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "statusReason" TEXT,
ALTER COLUMN "payload" DROP NOT NULL;
