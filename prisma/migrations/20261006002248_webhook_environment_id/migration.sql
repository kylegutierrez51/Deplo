-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "environmentId" TEXT;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
