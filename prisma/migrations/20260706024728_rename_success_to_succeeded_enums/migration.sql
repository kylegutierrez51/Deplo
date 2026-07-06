/*
  Warnings:

  - The values [SUCCESS] on the enum `RunStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUCCESS] on the enum `StageStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RunStatus_new" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
ALTER TABLE "public"."pipeline_runs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "pipeline_runs" ALTER COLUMN "status" TYPE "RunStatus_new" USING ("status"::text::"RunStatus_new");
ALTER TYPE "RunStatus" RENAME TO "RunStatus_old";
ALTER TYPE "RunStatus_new" RENAME TO "RunStatus";
DROP TYPE "public"."RunStatus_old";
ALTER TABLE "pipeline_runs" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StageStatus_new" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'AWAITING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'CANCELLED');
ALTER TABLE "public"."stage_results" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "stage_results" ALTER COLUMN "status" TYPE "StageStatus_new" USING ("status"::text::"StageStatus_new");
ALTER TYPE "StageStatus" RENAME TO "StageStatus_old";
ALTER TYPE "StageStatus_new" RENAME TO "StageStatus";
DROP TYPE "public"."StageStatus_old";
ALTER TABLE "stage_results" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
