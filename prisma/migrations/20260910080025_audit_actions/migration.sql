/*
  Warnings:

  - The values [PIPELINE_TRIGGERED] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.
  - The values [APPROVAL,STAGE_RESULT,SETTING] on the enum `ResourceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('PIPELINE_CREATED', 'PIPELINE_UPDATED', 'PIPELINE_DELETED', 'PIPELINE_DEFINITION_UPDATED', 'SECRET_CREATED', 'SECRET_UPDATED', 'SECRET_DELETED', 'ENVIRONMENT_CREATED', 'ENVIRONMENT_UPDATED', 'ENVIRONMENT_DELETED', 'WEBHOOK_RECEIVED', 'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED', 'RUN_TRIGGERED', 'RUN_COMPLETED', 'RUN_CANCELLED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'USER_ROLE_CHANGED');
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ResourceType_new" AS ENUM ('PIPELINE', 'SECRET', 'ENVIRONMENT', 'WEBHOOK', 'PIPELINE_RUN');
ALTER TABLE "audit_logs" ALTER COLUMN "resourceType" TYPE "ResourceType_new" USING ("resourceType"::text::"ResourceType_new");
ALTER TYPE "ResourceType" RENAME TO "ResourceType_old";
ALTER TYPE "ResourceType_new" RENAME TO "ResourceType";
DROP TYPE "public"."ResourceType_old";
COMMIT;
