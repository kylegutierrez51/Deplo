-- DropForeignKey
ALTER TABLE "environments" DROP CONSTRAINT "environments_createdById_fkey";

-- DropForeignKey
ALTER TABLE "pipelines" DROP CONSTRAINT "pipelines_createdById_fkey";

-- DropForeignKey
ALTER TABLE "secrets" DROP CONSTRAINT "secrets_createdById_fkey";

-- AlterTable
ALTER TABLE "environments" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pipelines" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "secrets" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
