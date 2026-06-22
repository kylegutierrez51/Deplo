/*
  Warnings:

  - The values [SKIPPED] on the enum `StageStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StageStatus_new" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'AWAITING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'CANCELLED');
ALTER TABLE "public"."stage_results" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "stage_results" ALTER COLUMN "status" TYPE "StageStatus_new" USING ("status"::text::"StageStatus_new");
ALTER TYPE "StageStatus" RENAME TO "StageStatus_old";
ALTER TYPE "StageStatus_new" RENAME TO "StageStatus";
DROP TYPE "public"."StageStatus_old";
ALTER TABLE "stage_results" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
