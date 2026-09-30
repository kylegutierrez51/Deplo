-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "defaultEnvironmentId" TEXT;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_defaultEnvironmentId_fkey" FOREIGN KEY ("defaultEnvironmentId") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
