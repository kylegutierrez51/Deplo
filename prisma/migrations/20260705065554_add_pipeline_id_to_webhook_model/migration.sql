-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "pipelineId" TEXT;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
