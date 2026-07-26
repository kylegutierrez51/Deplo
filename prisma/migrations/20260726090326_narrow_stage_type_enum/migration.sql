/*
  Warnings:

  - The values [BUILD,TEST,SCRIPT] on the enum `StageType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StageType_new" AS ENUM ('CUSTOM', 'DEPLOY', 'APPROVAL');
ALTER TABLE "stage_results" ALTER COLUMN "stageType" TYPE "StageType_new" USING ("stageType"::text::"StageType_new");
ALTER TYPE "StageType" RENAME TO "StageType_old";
ALTER TYPE "StageType_new" RENAME TO "StageType";
DROP TYPE "public"."StageType_old";
COMMIT;
