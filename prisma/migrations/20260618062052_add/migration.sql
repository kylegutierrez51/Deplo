-- AlterTable
ALTER TABLE "pipeline_definitions" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "pipeline_definitions" ADD CONSTRAINT "pipeline_definitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
